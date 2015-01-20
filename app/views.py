#!/usr/bin/env python
import sys
sys.path.insert(0, "/home2/thezeith/opt/python27/lib/python2.7/site-packages/" )

from datetime import datetime
from flask import Flask, request, jsonify, render_template

from flask import make_response
from functools import wraps, update_wrapper
from datetime import datetime
from dateutil import parser
import time

import flask

import sqlalchemy
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

import requests

import json
import httplib
import urllib

from application_only_auth import Client

import traceback

import urllib
import os

from datetime import datetime
from flask import Flask,session, request, flash, url_for, redirect, render_template, abort ,g
from flask.ext.sqlalchemy import SQLAlchemy
from flask.ext.login import LoginManager
from flask.ext.login import login_user , logout_user , current_user , login_required
#from werkzeug.security import generate_password_hash, check_password_hash

from app import app, db, login_manager, BASE_URL
from app.models import User, Todo, TwitterAuth

import json
import copy


@app.route('/')
def index():
 #   return 'yo'
    return render_template('marketing.html')


@app.route('/api/register' , methods=['GET','POST'])
def register():
    username = request.form['username']
    password = request.form['password']
    email = request.form['email']

    user = User( username, password, email )
    db.session.add(user)
    db.session.commit()
    return '{ "status" : 200 }'

@app.route('/api/login',methods=['GET','POST'])
def login():    
    username = request.form['username']
    password = request.form['password']
    remember_me = False
    if 'remember_me' in request.form:
        remember_me = True
    registered_user = User.query.filter_by(username=username).first()
    if registered_user is None:
        flash('Username is invalid' , 'error')
        return redirect(url_for('login'))
    if not registered_user.check_password(password):
        flash('Password is invalid','error')
        return redirect(url_for('login'))
    login_user(registered_user, remember = remember_me)
    return '{ "status" : 200 }'

@app.route('/api/logout')
def logout():
    logout_user()
    return '{ "status" : 200 }'

@login_manager.user_loader
def load_user(id):
    return User.query.get(int(id))

@app.before_request
def before_request():
    g.user = current_user

def nocache(view):
    @wraps(view)
    def no_cache(*args, **kwargs):
        response = make_response(view(*args, **kwargs))
        response.headers['Last-Modified'] = datetime.now()
        response.headers['Cache-Control'] = 'no-store, no-cache, must-revalidate, post-check=0, pre-check=0, max-age=0'
        response.headers['Pragma'] = 'no-cache'
        response.headers['Expires'] = '-1'
        return response
    return update_wrapper(no_cache, view)

### TWITTER STUFF ###

CONSUMER_TOKEN = '8hvCH7y43QAAnPrPaU4tQVE5q'
CONSUMER_SECRET = 'Xu07aHEVDlLbIHlPL8NQfkiwDB0K4jFH3de0UwGfSXjeZhT4dN'

from flask import request
import tweepy

auth_twitter_session = dict()
db_twitter = dict() #you can save these values to a database
TWITTER_API = None 

@app.route("/api/authtwitter",  methods = ['POST', 'GET'] )
def send_token():
    auth = tweepy.OAuthHandler(CONSUMER_TOKEN, 
                               CONSUMER_SECRET )
    try: 
		#get the request tokens
        redirect_url= auth.get_authorization_url()
        auth_twitter_session['request_token']= (auth.request_token.key,
                                   auth.request_token.secret)
    except tweepy.TweepError:
        print 'Error! Failed to get request token'

    data = { 'redirect_url' : redirect_url }
    data = json.dumps( data )

    return data
 
@app.route("/verify")
def get_verification():
    
    time.sleep(5) #wait for dictionary to be populated?
    token = auth_twitter_session['request_token']
    verifier= request.args['oauth_verifier']

    del auth_twitter_session['request_token']
    auth = tweepy.OAuthHandler(CONSUMER_TOKEN, 
                               CONSUMER_SECRET )
    auth.set_request_token(token[0], token[1])

    try:
        auth.get_access_token(verifier)
    except tweepy.TweepError:
        print 'Error! Failed to get access token.'
        
    twitter_auth = TwitterAuth( auth.access_token.key, auth.access_token.secret, g.user.id )
    db.session.add( twitter_auth )
    db.session.commit()
    return redirect( BASE_URL + '/#/dashboard')
   # return flask.render_template('index.html')
 
def twitterApi():
    auth = tweepy.OAuthHandler(CONSUMER_TOKEN, CONSUMER_SECRET)
    twitter_auth  = TwitterAuth.query.filter( TwitterAuth.user_id == g.user.id ).first() 
    auth.set_access_token( twitter_auth.access_token_key, twitter_auth.access_token_secret)
    TWITTER_API = tweepy.API(auth, parser=tweepy.parsers.JSONParser() )
    return TWITTER_API

@app.route("/api/twitter/<tweepy_endpoint>", methods=['GET', 'POST'])
def twitterApiEndpoints(tweepy_endpoint):
    req = request.get_json() #GET request    
    twitterAPI = twitterApi()

    try:
        blah = getattr( twitterAPI, tweepy_endpoint )
        data = blah( **req )
        data = json.dumps( data )
        return data
    except Exception as e:
        message = str( e )
        return message

######## CONSTRUCT CONVERSATIONS ############
@app.route("/api/twitter/convos", methods=['GET', 'POST'])
def mentions():
    auth = tweepy.OAuthHandler(CONSUMER_TOKEN, CONSUMER_SECRET)
    twitter_auth  = TwitterAuth.query.filter( TwitterAuth.user_id == g.user.id ).first() 
    auth.set_access_token( twitter_auth.access_token_key, twitter_auth.access_token_secret)

    TWITTER_API = tweepy.API(auth, parser=tweepy.parsers.JSONParser() )
    mentions = TWITTER_API.mentions_timeline()
    
    timeline = []
    mentionsItems = []

    for item in mentions:
        if item['in_reply_to_status_id_str']:
            mentionsItems.append( item )

    tweets = TWITTER_API.user_timeline();
    for item in tweets:
        if item['in_reply_to_status_id_str']:
            timeline.append( item )

    convos = timeline + mentions
            
    convo_list_with_timestamps = []
    for tweet in convos:
        with_timestamp = add_timestamp( tweet )
        convo_list_with_timestamps.append( with_timestamp )
        
    convo_list_with_timestamps = sorted( convo_list_with_timestamps, key=lambda aa:aa["timestamp"], reverse=True )
    convos = convo_list_with_timestamps

    ccc = []
    while len( convos ) > 0:
        convo = []
        bb = convos.pop(0)
        convo.append( bb )
        for i, item in enumerate( list( convo_list_with_timestamps ) ):
            if bb['in_reply_to_status_id_str'] == item['id_str']:
                convo.append( item )
                bb = convos.pop(i)
        ccc.append( convo )
    
    eee = []
    for item in ccc:
        eee.append( item[::-1] )
    
    ddd = add_root_convo( eee )

    data = json.dumps( ddd )
    return data

def add_timestamp( tweet ):
    temp = parser.parse( tweet["created_at"] )
    temp = temp.timetuple()
    timestamp = time.mktime( temp )
    tweet['timestamp'] = timestamp
    return tweet

def add_root_convo( convos ):
    auth = tweepy.OAuthHandler(CONSUMER_TOKEN, CONSUMER_SECRET)
    twitter_auth  = TwitterAuth.query.filter( TwitterAuth.user_id == g.user.id ).first() 
    auth.set_access_token( twitter_auth.access_token_key, twitter_auth.access_token_secret)
    TWITTER_API = tweepy.API(auth, parser=tweepy.parsers.JSONParser() )
    for i, item in enumerate( list(convos) ):
        in_reply_to_status_id_str = item[0]['in_reply_to_status_id_str']
        try:
            status = TWITTER_API.get_status( in_reply_to_status_id_str )
            convos[i].insert( 0, status )
        except:
            pass
    return convos

@app.errorhandler(500)
def internal_error(exception):
    app.logger.exception(exception)
    aa = str( type( exception ) )
    aa = traceback.format_exc()
    return aa

if __name__ == '__main__':
    app.run(debug=True)
