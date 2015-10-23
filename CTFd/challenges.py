from flask import current_app as app, flash, render_template, request, redirect, abort, jsonify, json as json_mod, url_for, session, Blueprint

from CTFd.utils import ctftime, view_after_ctf, authed, unix_time, get_kpm, can_view_challenges, is_admin, get_config
from CTFd.models import db, Challenges, Files, Solves, WrongKeys, Keys

import time
import re
import logging
import json
import itertools

challenges = Blueprint('challenges', __name__)


@challenges.route('/challenges', methods=['GET'])
def challenges_view():
    if not is_admin():
        if not ctftime():
            if view_after_ctf():
                pass
            else:
                flash('the CTF is currently not active')
                return redirect('/')
    if can_view_challenges():
        return render_template('chals.html', ctftime=ctftime())
    else:
        return redirect('/login')


@challenges.route('/chals', methods=['GET'])
def chals():
    if not is_admin():
        if not ctftime():
            if view_after_ctf():
                pass
            else:
                flash('the CTF is currently not active')
                return redirect('/')
    if can_view_challenges():
        chals = Challenges.query.add_columns('id', 'name', 'value', 'description', 'category').order_by(Challenges.value).all()
        #tags = Tags.query.add_columns('id', 'chal', 'tag').all()
        #tagsByChal = itertools.groupby(sorted(tags, lambda x: x['chal']), lambda x: x['chal'])

        json = {'game':[]}
        for x in chals:
            files = [ str(f.location) for f in Files.query.filter_by(chal=x.id).all() ]
            json['game'].append({'id':x[1], 'name':x[2], 'value':x[3], 'description':x[4], 'category':x[5], 'files':files})

        db.session.close()
        return jsonify(json)
    else:
        db.session.close()
        return redirect('/login')


@challenges.route('/chals/solves')
def chals_per_solves():
    if can_view_challenges():
        solves = Solves.query.add_columns(db.func.count(Solves.chalid)).group_by(Solves.chalid).all()
        json = {}
        for chal, count in solves:
            json[chal.chal.name] = count
        return jsonify(json)
    return redirect('/login')


@challenges.route('/solves')
@challenges.route('/solves/<teamid>')
def solves(teamid=None):
    if teamid is None:
        if authed():
            solves = Solves.query.filter_by(teamid=session['id']).all()
        else:
            abort(401)
    else:
        solves = Solves.query.filter_by(teamid=teamid).all()
    db.session.close()
    json = {'solves':[]}
    for x in solves:
        json['solves'].append({ 'chal':x.chal.name, 'chalid':x.chalid,'team':x.teamid, 'value': x.chal.value, 'category':x.chal.category, 'time':unix_time(x.date)})
    return jsonify(json)


@challenges.route('/maxattempts')
def attempts():
    chals = Challenges.query.add_columns('id').all()
    json = {'maxattempts':[]}
    for chal, chalid in chals:
        fails = WrongKeys.query.filter_by(team=session['id'], chalid=chalid).count()
        if fails >= int(get_config("max_tries")) and int(get_config("max_tries")) > 0:
            json['maxattempts'].append({'chalid':chalid})
    return jsonify(json)


@challenges.route('/fails/<teamid>', methods=['GET'])
def fails(teamid):
    fails = WrongKeys.query.filter_by(team=teamid).count()
    solves = Solves.query.filter_by(teamid=teamid).count()
    db.session.close()
    json = {'fails':str(fails), 'solves': str(solves)}
    return jsonify(json)


@challenges.route('/chal/<chalids>/solves', methods=['GET'])
def who_solved(chalids):
    chalids = chalids.split(",")
    solves = Solves.query.filter(Solves.chalid.in_(chalids)).order_by(Solves.date.asc())
    json = {'teams':[]}
    for solve in solves:
        json['teams'].append({'id':solve.team.id, 'name':solve.team.name, 'date':solve.date})
    return jsonify(json)


@challenges.route('/chal/<chalids>', methods=['POST'])
def chal(chalids):
    if not ctftime():
        return redirect('/challenges')
    if authed():
        logger = logging.getLogger('keys')

        chalids = map(lambda x: int(x), chalids.split(","))
        num_submitted = len(chalids)

        fails = WrongKeys.query.filter(WrongKeys.team == session['id'], WrongKeys.chalid.in_(chalids)).count()
        
        data = (time.strftime("%m/%d/%Y %X"), session['username'].encode('utf-8'), request.form['key'].encode('utf-8'), get_kpm(session['id']))
        print("[{0}] {1} submitted {2} with kpm {3}".format(*data))

        # Hit max attempts
        if fails >= int(get_config("max_tries")) and int(get_config("max_tries")) > 0:
            return "4" #too many tries on this challenge


        # TODO this might be too restrictive on large grouped challenges, consider multiplying by num of challenges
        try:
            max_submit_rate = int(get_config("max_submit_rate"))
        except ValueError:
            max_submit_rate = 0
        # Anti-bruteforce / submitting keys too quickly
        if max_submit_rate and get_kpm(session['id']) > max_submit_rate:
            for chalid in chalids:
                wrong = WrongKeys(session['id'], chalid, request.form['key'])
                db.session.add(wrong)
            db.session.commit()
            db.session.close()
            logger.warn("[{0}] {1} submitted {2} with kpm {3} [TOO FAST]".format(*data))
            return "3" # Submitting too fast

        solves = Solves.query.filter(Solves.teamid == session['id'], Solves.chalid.in_(chalids)).all()
        if len(solves) < num_submitted: # unsolved challenges

            solvedIds = set(map(lambda x: x.chalid, solves))
            unsolvedIds = set(chalids).difference(solvedIds) # watch element types here
            challenges = Challenges.query.filter(Challenges.id.in_(chalids)).order_by(Challenges.value).all()

            for chal in challenges:
                chalid = int(chal.id)
                key = str(request.form['key'].strip().lower())
                keys = json.loads(chal.flags)
                for x in keys:
                    # TODO: merge static/regex into a single case and return already-solved when appropriate
                    if x['type'] == 0 and x['flag'] == key.strip().lower() or x['type'] == 1 and matches(key, str(x['flag'])):
                        if chalid in unsolvedIds and chalid not in solvedIds:
                            solve = Solves(chalid=chalid, teamid=session['id'], ip=request.remote_addr, flag=key)
                            db.session.add(solve)
                            db.session.commit()
                            db.session.close()
                            logger.info("[{0}] {1} submitted {2} with kpm {3} [CORRECT]".format(*data))
                            return "1" # key was correct
                        else:
                            logger.info("{0} submitted {1} with kpm {2} [ALREADY SOLVED]".format(*data))
                            return "2" # challenge was already solved

                if chalid in unsolvedIds and chalid not in solvedIds:
                    wrong = WrongKeys(session['id'], chalid, request.form['key'])
                    db.session.add(wrong)                
                    logger.info("[{0}] {1} submitted {2} with kpm {3} [WRONG]".format(*data))
            db.session.commit()
            db.session.close()
            return '0' # key was wrong

        # Challenge already solved
        else:
            logger.info("{0} submitted {1} with kpm {2} [ALREADY SOLVED]".format(*data))
            return "2" # challenge was already solved
    else:
        return "-1"

def matches(p, s):
    res = re.match(s, p, re.IGNORECASE)
    return res and res.group() == p