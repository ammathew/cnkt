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
    
    convos = []

    for item in mentions:
        if item['in_reply_to_status_id_str']:
            convos.append( item )
    
    tweets = TWITTER_API.user_timeline();
    for item in tweets:
        if item['in_reply_to_status_id_str']:
            convos.append( item )
     
    convo_list_with_timestamps = []
    for tweet in convos:
        with_timestamp = add_timestamp( tweet )
        convo_list_with_timestamps.append( with_timestamp )

    convo_list_with_timestamps = sorted( convo_list_with_timestamps, key=lambda aa:aa["timestamp"], reverse=True )
    convo_superset = create_superset( convo_list_with_timestamps )
   
    data = json.dumps( convo_superset )
    return data

def add_timestamp( tweet ):
    temp = parser.parse( tweet["created_at"] )
    temp = temp.timetuple()
    timestamp = time.mktime( temp )
    tweet['timestamp'] = timestamp
    return tweet
    

def create_superset( convos ):
    auth = tweepy.OAuthHandler(CONSUMER_TOKEN, CONSUMER_SECRET)
    twitter_auth  = TwitterAuth.query.filter( TwitterAuth.user_id == g.user.id ).first() 
    auth.set_access_token( twitter_auth.access_token_key, twitter_auth.access_token_secret)
    TWITTER_API = tweepy.API(auth, parser=tweepy.parsers.JSONParser() )
    convo_superset = []
   
    i = 0
    for item in convos:
        i = i + 1 
        if i > 10 : # stop-cap to prevent rate limiting
            break
        convo = []
        convo.append( item )
        in_reply_to_status_id_str = item['in_reply_to_status_id_str']
            
        while in_reply_to_status_id_str:
            status = TWITTER_API.get_status( in_reply_to_status_id_str )
            convo.insert( 0, status )
            try:
                in_reply_to_status_id_str = status['in_reply_to_status_id_str']
            except:
                convo_superset.append( convo )
                break
            if len( convo ) < 5 :
                convo_superset.append( convo )
            else:
                break

    convo_superset_2 = []
    for item in convo_superset:
        if item not in convo_superset_2:
            convo_superset_2.append( item )

    #add timestamp to each object; sort by timestamp
    convo_superset_3 = []
    for convo in convo_superset_2:
        convo_with_timestamps = []
        for item in convo:
            item_2 = item.copy()
            temp = parser.parse( item["created_at"] )
            temp = temp.timetuple()
            timestamp = time.mktime( temp )
            item_2['timestamp'] = timestamp
            convo_with_timestamps.append( item_2 )
        convo_superset_3.append( convo_with_timestamps )

    convo_superset_4 = sorted( convo_superset_3, key=lambda convo:convo[-1]["timestamp"], reverse=True )

    return convo_superset_4

@app.errorhandler(500)
def internal_error(exception):
    app.logger.exception(exception)
    aa = str( type( exception ) )
    aa = traceback.format_exc()
    return aa

if __name__ == '__main__':
    app.run(debug=True)
