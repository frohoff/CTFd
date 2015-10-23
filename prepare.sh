#!/bin/sh

sudo apt-get install build-essential python-dev python-pip libffi-dev gunicorn -y
pip install -r requirements.txt
