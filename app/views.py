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
from app.models import User, TwitterAuth, StripeCustomer

import json
import copy
import stripe

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
    user = {}
    user['username'] = registered_user.username
    user['email'] = registered_user.email
    return json.dumps( user )

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

    #raise Exception( auth.request_token )

    try: 
		#get the request tokens
        redirect_url= auth.get_authorization_url()
        auth_twitter_session['request_token'] = auth.request_token
    except tweepy.TweepError:
        print 'Error! Failed to get request token'

    data = { 'redirect_url' : redirect_url }
    data = json.dumps( data )

    return data
 
@app.route("/verify")
def get_verification():
    
    i = 0;
    while i<20:
        try:
            token = auth_twitter_session['request_token']
            break
        except: 
            time.sleep(1)
            pass

    verifier= request.args['oauth_verifier']
    del auth_twitter_session['request_token']

    auth = tweepy.OAuthHandler(CONSUMER_TOKEN, 
                               CONSUMER_SECRET )
    auth.request_token = token

    auth.get_access_token(verifier)

    try: #delete existing twitter auth, if exists
        twitter_auths  = TwitterAuth.query.filter( TwitterAuth.user_id == g.user.id ).all() 
        first_authorized_on = twitter_auths[0].first_authorized_on
        for item in twitter_auths:
            db.session.delete( item )
            db.session.commit()
    except:
        pass

    auth.set_access_token( auth.access_token, auth.access_token_secret)
    TWITTER_API = tweepy.API(auth, parser=tweepy.parsers.JSONParser() )
    user_info = TWITTER_API.me()
    twitter_user_id = user_info['id_str']

    if first_authorized_on:
        pass
    else:
        first_authorized_on = datetime.utcnow()

    twitter_auth = TwitterAuth( auth.access_token, auth.access_token_secret, g.user.id, twitter_user_id, first_authorized_on )

    db.session.add( twitter_auth )
    db.session.commit()
    return redirect( BASE_URL + '/#/dashboard')
 
def twitterApi():
    auth = tweepy.OAuthHandler(CONSUMER_TOKEN, CONSUMER_SECRET)
    twitter_auth  = TwitterAuth.query.filter( TwitterAuth.user_id == g.user.id ).first() 
  #  raise Exception( len( twitter_auth ) )
    auth.set_access_token( twitter_auth.access_token_key, twitter_auth.access_token_secret)
    TWITTER_API = tweepy.API(auth, parser=tweepy.parsers.JSONParser() )
    return TWITTER_API

@app.route("/api/twitter/<tweepy_endpoint>", methods=['GET', 'POST'])
def twitterApiEndpoints(tweepy_endpoint):
   # raise Exception( 'yo' )
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
    tweets = TWITTER_API.user_timeline();

    convosAll = tweets + mentions
    convosAll = [  x for x in convosAll if x['in_reply_to_status_id_str'] is not None ]
    #  convos = map ( add_timestamp, convosAll )

    convos = []
    for item in convosAll:
        itemWithTimestamp = add_timestamp( item ) 
        convos.append( itemWithTimestamp )
                    
    convos = sorted( convos, key=lambda aa:aa["timestamp"], reverse=True )


   # replyIdDict = build_dict( convos, key='in_reply_to_status_id_str' )
    idDict = build_dict( convos, key='id_str' )
        
    ccc = []    
    while len(idDict ) > 0 :
        for item in convos:
            if ( item["id_str"] in idDict.keys() ):
                convo = []
                aa = idDict.pop( item["id_str"] )
                convo.append( aa )
                eoc = False 
                while not eoc:
                    inReplyToStatusIdStr= aa['in_reply_to_status_id_str'] 
                    if ( inReplyToStatusIdStr in idDict.keys() ):
                        aa = idDict.pop( inReplyToStatusIdStr )
                        convo.append( aa )
                    else:
                       # try:
                       #     aa = TWITTER_API.get_status( convo[-1]['in_reply_to_status_id_str'] ) 
                       #     convo.append( aa )
                      #  except:
                     #       pass
                        ccc.append( convo )
                        eoc = True

    eee = []
    for item in ccc:
        eee.append( item[::-1] )
    
    eee = add_root_convos( eee )

    data = json.dumps( eee )

    return data

def build_dict(seq, key):
    return dict((d[key], dict(d, index=i)) for (i, d) in enumerate(seq))

def add_timestamp( tweet ):
    temp = parser.parse( tweet["created_at"] )
    temp = temp.timetuple()
    timestamp = time.mktime( temp )
    tweet['timestamp'] = timestamp
    return tweet

def add_root_convos( convos ):
    auth = tweepy.OAuthHandler(CONSUMER_TOKEN, CONSUMER_SECRET)
    twitter_auth  = TwitterAuth.query.filter( TwitterAuth.user_id == g.user.id ).first() 
    auth.set_access_token( twitter_auth.access_token_key, twitter_auth.access_token_secret)
    TWITTER_API = tweepy.API(auth, parser=tweepy.parsers.JSONParser() )

    status_ids = []
    for i, item in enumerate( list(convos) ):
        status_ids.append( item[0]['in_reply_to_status_id_str'] )
        
    statuses = TWITTER_API.statuses_lookup( status_ids, map_=True )
            
    for i, item in enumerate( list(convos) ):
        try:
            convos[i].insert(0, statuses["id"][  item[0]['in_reply_to_status_id_str'] ] )
        except: 
            pass

    return convos

@app.errorhandler(500)
def internal_error(exception):
    app.logger.exception(exception)
    aa = str( type( exception ) )
    aa = traceback.format_exc()
    return aa

### CHARGING THE USER ####

@app.route("/api/stripe/createCustomer", methods=['GET', 'POST'])
def create_customer():
    token = request.form['stripeToken']
    stripe.api_key = 'sk_test_F4XR1cnPuvLDX5nDk4VbjIhX'
    customer = stripe.Customer.create(
        card=token,
        description= g.user.email
    )
    
    stripe_customer = StripeCustomer( customer.id, g.user.id )
    db.session.add( stripe_customer )
    db.session.commit()

    return "ok"

if __name__ == '__main__':
    app.run(debug=True)
