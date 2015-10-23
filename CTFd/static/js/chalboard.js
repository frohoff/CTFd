//http://stackoverflow.com/a/2648463 - wizardry!
String.prototype.format = String.prototype.f = function() {
    var s = this,
        i = arguments.length;

    while (i--) {
        s = s.replace(new RegExp('\\{' + i + '\\}', 'gm'), arguments[i]);
    }
    return s;
};

function htmlentities(string) {
    return $('<div/>').text(string).html();
}

//http://stackoverflow.com/a/7616484
String.prototype.hashCode = function() {
    var hash = 0, i, chr, len;
    if (this.length == 0) return hash;
    for (i = 0, len = this.length; i < len; i++) {
        chr   = this.charCodeAt(i);
        hash  = ((hash << 5) - hash) + chr;
        hash |= 0; // Convert to 32bit integer
    }
    return hash;
};

var challenges;

function loadchal(id) {
    var grouped = groupchals(challenges['game']);
    var obj;
    for (cat in grouped) {
      chals = grouped[cat];
      for (i in chals) {
        chal = chals[i];
        if (chal.id == id) {
          obj = chal;
        }
      }
    }
/*    obj = $.grep(challenges['game'], function (e) {
        return e.id == id;
    })[0]*/
    window.location.hash = obj.name
    $('#chal-window .chal-name').text(obj.name)
    $('#chal-window .chal-desc').html(marked(obj.description, {'gfm':true, 'breaks':true}))

    for (var i = 0; i < obj.files.length; i++) {
        filename = obj.files[i].split('/')
        filename = filename[filename.length - 1]
        $('#chal-window .chal-desc').append("<a href='"+obj.files[i]+"'>"+filename+"</a><br/>")
    };

    $('#chal-window .chal-value').text(obj.value)
    $('#chal-window .chal-category').text(obj.category)
    $('#chal-window #chal-id').val(obj.id)
    $('#chal-window .chal-solves').text(obj.solves + " solves")
    $('#answer').val("")

    $('pre code').each(function(i, block) {
        hljs.highlightBlock(block);
    });
    $('#chal-window').foundation('reveal', 'open');
}

function loadchalbyname(chalname) {
/*  obj = $.grep(challenges['game'], function (e) {
      return e.name == chalname;
  })[0]*/
  var grouped = groupchals(challenges['game']);
  var obj;
  for (cat in grouped) {
    chals = grouped[cat];
    for (i in chals) {
      chal = chals[i];
      if (chal.name == chalname) {
        obj = chal;
      }
      if (chal.grouped) {
        for (j in chal.members) {
          mem = chal.members[j];
          if (mem.name == chalname) {
            obj = mem;
          }
        }
      }
    }
  }

  window.location.hash = obj.name
  $('#chal-window .chal-name').text(obj.name)
  $('#chal-window .chal-desc').html(marked(obj.description, {'gfm':true, 'breaks':true}))

  for (var i = 0; i < obj.files.length; i++) {
      filename = obj.files[i].split('/')
      filename = filename[filename.length - 1]
      $('#chal-window .chal-desc').append("<a href='"+obj.files[i]+"'>"+filename+"</a><br/>")
  };

  $('#chal-window .chal-value').text(obj.value)
  $('#chal-window .chal-category').text(obj.category)
  $('#chal-window #chal-id').val(obj.id)
  $('#chal-window .chal-solves').text(obj.solves + " solves")
  $('#answer').val("")

  $('pre code').each(function(i, block) {
      hljs.highlightBlock(block);
  });
  
  $('#chal-window').foundation('reveal', 'open');
}


$("#answer").keyup(function(event){
    if(event.keyCode == 13){
        $("#submit-key").click();
    }
});


function submitkey(chal, key, nonce) {
    $.post("/chal/" + chal, {
        key: key, 
        nonce: nonce
    }, function (data) {
        if (data == -1){
          window.location="/login"
          return
        }
        else if (data == 0){ // Incorrect key
          $('#submit-key').text('Incorrect, sorry')
          $('#submit-key').css('background-color', 'red')
          $('#submit-key').prop('disabled', true)
        }
        else if (data == 1){ // Challenge Solved
          $('#submit-key').text('Correct!')
          $('#submit-key').css('background-color', 'green')
          $('#submit-key').prop('disabled', true)
          $('#chal-window .chal-solves').text( (parseInt($('#chal-window .chal-solves').text().split(" ")[0]) + 1 +  " solves") )
        }
        else if (data == 2){ // Challenge already solved
          $('#submit-key').text('You already solved this')
          $('#submit-key').prop('disabled', true)
        }
        else if (data == 3){ // Keys per minute too high
          $('#submit-key').text("You're submitting keys too fast. Slow down.")
          $('#submit-key').css('background-color', '#e18728')
          $('#submit-key').prop('disabled', true)
        }
        else if (data == 4){ // too many incorrect solves
          $('#submit-key').text('Too many attempts.')
          $('#submit-key').css('background-color', 'red')
          $('#submit-key').prop('disabled', true)
        }
        marktoomanyattempts()
        marksolves()
        updatesolves()
        setTimeout(function(){
          $('#submit-key').text('Submit')
          $('#submit-key').prop('disabled', false)
          $('#submit-key').css('background-color', '#007095')
        }, 3000);
    })
}

function marksolves() {
    $.get('/solves', function (data) {
        solves = $.parseJSON(JSON.stringify(data));
        solvesById = []
        for (var i = solves['solves'].length - 1; i >= 0; i--) {
          var solve = solves['solves'][i];
          id = solve.chalid
          solvesById[id] = solve;          
        };        

        var grouped = groupchals(challenges['game']);
        for (cat in grouped) {
          var chals = grouped[cat];
          for (i in chals) {
            var chal = chals[i];  
            var chalid = chal.id;          
            var solvedValue = 0;
            var elt = $('#challenges button[value="' + chalid + '"]');
            if (chal.grouped) {
              for (m in chal.members) {
                var mem = chal.members[m];
                var solve = solvesById[mem.id];
                solvedValue += solve && solve.value || 0;
              }
              elt.find("span.solvedValue").text(solvedValue);
            } else {
              var solve = solvesById[chal.id]
              solvedValue = solve && solve.value || 0;
            }           

            if (chal.value && solvedValue == chal.value) {
                elt.addClass('secondary')
                elt.css('opacity', '0.3');
            } else if (solvedValue > 0) {                             
                elt.css('opacity', '0.6');              
            }            
          }
        }

/*        for (var i = solves['solves'].length - 1; i >= 0; i--) {
            id = solves['solves'][i].chalid
            $('#challenges button[value="' + id + '"]').addClass('secondary')
            $('#challenges button[value="' + id + '"]').css('opacity', '0.3')
        };*/
        // if (window.location.hash.length > 0){
        //   loadchalbyname(window.location.hash.substring(1))
        // }
    });
}

function marktoomanyattempts() {
    $.get('/maxattempts', function (data) {
        maxattempts = $.parseJSON(JSON.stringify(data));
        for (var i = maxattempts['maxattempts'].length - 1; i >= 0; i--) {
            id = maxattempts['maxattempts'][i].chalid
            $('#challenges button[value="' + id + '"]').addClass('secondary')
            $('#challenges button[value="' + id + '"]').css('background-color', '#FF9999')
        };
        // if (window.location.hash.length > 0){
        //   loadchalbyname(window.location.hash.substring(1))
        // }
    });
}

function updatesolves(){
    $.get('/chals/solves', function (data) {
      solves = $.parseJSON(JSON.stringify(data));
      chals = Object.keys(solves);

      for (var i = 0; i < chals.length; i++) {  
        obj = $.grep(challenges['game'], function (e) {
            return e.name == chals[i];
        })[0]
        obj.solves = solves[chals[i]]
      };

    });
}

function getsolves(id){
  $.get('/chal/'+id+'/solves', function (data) {
    var teams = data['teams'];
    var box = $('#chal-solves-names');
    box.empty();
    for (var i = 0; i < teams.length; i++) {
      var id = teams[i].id;
      var name = teams[i].name;
      var date = moment(teams[i].date).local().format('LLL');
      box.append('<tr><td><a href="/team/{0}">{1}</td><td>{2}</td></tr>'.format(id, htmlentities(name), date));
    };
  });
}

function chalgroup(n) {
  var split = $.map(n.split(":"), function(x, i) { return x.trim(); });
  if (split.length == 1) {
    split.unshift(null);
  }
  return split;
}

function compareValues(a,b) {
    return a.value - b.value;
}

function notempty(v){return v!==''}

function groupchals(chals) {  
  var cats = {};
  var groups = {};
  var catGroups = [];

  for (i = 0; chals[i]; i++) {
      var chal = chals[i];
      var cat = chal.category;
      if (!cats[cat]) {
        cats[cat] = [];
      }
      var grouping = chalgroup(chals[i].name);
      var group = grouping[0];      
      if (group) {
        var catGroup = [cat, group];
        if (!groups[catGroup]) {
          groups[catGroup] = [];
          catGroups.push(catGroup);
        }
        groups[catGroup].push(chal);
      } else {
        cats[cat].push(chal);
      }
  };

  for (i in catGroups) {
    var catGroup = catGroups[i];
    var groupChals = groups[catGroup].sort(compareValues);
    var ids = [];
    var names = [];
    var descs = [];
    var values = [];
    var files = [];
    var solves = 0;
    var members = [];

    var cat = catGroup[0];
    var group = catGroup[1];    

    for (j in groupChals) {
      var chal = groupChals[j];
      members.push(chal);
      ids.push(chal.id);
      names.push(chal.name);
      descs.push(chal.description);   
      values.push(chal.value);
      files = files.concat(chal.files || []);
      solves += (chal.solves || 0);      
    }

    var chal = {
      grouped: true,
      id: ids.join(","),
      name: group,
      description: descs.filter(notempty).join("\n\n"),
      value: values.reduce(function(s, x){ return s + x; }, 0),
      category: cat,
      files: files,
      solves: solves,
      members: members
    };

    cats[cat].push(chal);
  }

  for (cat in cats) {
    cats[cat].sort(compareValues);
  }

  return cats;
}

function loadchals() {

    $.get("/chals", function (data) {
        categories = [];
        challenges = $.parseJSON(JSON.stringify(data));
        for (var i = challenges['game'].length - 1; i >= 0; i--) {
            challenges['game'][i].solves = 0;
        }
        var grouped = groupchals(challenges['game']);

/*        for (var i = challenges['game'].length - 1; i >= 0; i--) {
            challenges['game'][i].solves = 0
            if ($.inArray(challenges['game'][i].category, categories) == -1) {
                categories.push(challenges['game'][i].category)
                $('#challenges').append($('<tr id="' + challenges['game'][i].category.replace(/ /g,"-").hashCode() + '"><td class="large-2"><h4>' + challenges['game'][i].category + '</h4></td></tr>'))
            }
        };*/

        for (cat in grouped) {  
          var hash = cat.replace(/ /g,"-").hashCode();        
          categories.push(cat);
          $('#challenges').append(
            $('<tr id="' + cat.replace(/ /g,"-").hashCode() + '"><td class="large-2"><h4>' 
              + cat
            + '</h4></td></tr>'))
          var chals = grouped[cat];
          for (i in chals) {
            var chal = chals[i];            
            var chal_button = $((
              '<button class="chal-button" value="{0}"><p>{1}</p>'
              + (chal.grouped ? '<span class="solvedValue">0</span> / ' : '')
              + '<span class="totalValue">{2}</span></button>').format(chal.id, chal.name, chal.value));
            $('#' + hash).append(chal_button);
          }
        }

/*        for (var i = 0; i <= challenges['game'].length - 1; i++) {
            var chal = challenges['game'][i]
            var cat = chal.category.replace(/ /g,"-").hashCode();
            var chal_button = $('<button class="chal-button" value="{0}"><p>{1}</p><span>{2}</span></button>'.format(chal.id, chal.name, chal.value))
            $('#' + cat).append(chal_button);
        };*/
        
        updatesolves()
        marktoomanyattempts()
        marksolves()

        $('#challenges button').click(function (e) {
            loadchal(this.value);
        });

    });
}

$('#submit-key').click(function (e) {
    submitkey($('#chal-id').val(), $('#answer').val(), $('#nonce').val())
});

$('.chal-solves').click(function (e) {
    getsolves($('#chal-id').val())
});

// $.distint(array)
// Unique elements in array
$.extend({
    distinct : function(anArray) {
       var result = [];
       $.each(anArray, function(i,v){
           if ($.inArray(v, result) == -1) result.push(v);
       });
       return result;
    }
});
function colorhash (x) {
    color = ""
    for (var i = 20; i <= 60; i+=20){
        x += i
        x *= i
        color += x.toString(16)
    };
    return "#" + color.substring(0, 6)
}

$(document).on('close', '[data-reveal]', function () {
  window.location.hash = ""
});

// function solves_graph() {
//     $.get('/graphs/solves', function(data){
//         solves = $.parseJSON(JSON.stringify(data));
//         chals = []
//         counts = []
//         colors = []
//         i = 1
//         $.each(solves, function(key, value){
//             chals.push(key)
//             counts.push(value)
//             colors.push(colorhash(i++))
//         });

//     });
// }

function update(){
    $('#challenges').empty()
    loadchals()
    //solves_graph()
}

$(function() {
    loadchals()
    // solves_graph()
});

setInterval(update, 300000);
