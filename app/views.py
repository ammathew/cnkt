#!/usr/bin/env python
import sys
sys.path.insert(0, "/home2/thezeith/opt/python27/lib/python2.7/site-packages/" )

from datetime import datetime
from flask import Flask, request, jsonify, render_template, url_for

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

from app import app, db, login_manager, BASE_URL,  CONSUMER_TOKEN, CONSUMER_SECRET
from app.models import User, TwitterAuth, StripeCustomer
from app import mail

import json
import copy
import stripe

from flask.ext.mail import Mail, Message
from app import ts

@app.route('/')
def index():
 #   return 'yo'
    return render_template('marketing.html')


@app.route('/api/register' , methods=['GET','POST'])
def register():
    username = request.form['username']
    password = request.form['password']
    email = request.form['email']
    registered_user = User.query.filter(User.email==email).first()
    if registered_user:
        return json.dumps( { 'status' : 401, 'message': 'this email is already registered' })
    user = User( email, password )
    db.session.add(user)
    db.session.commit()

    subject = "Confirm your email"
    token = ts.dumps( email, salt='email-confirm-key')
    confirm_url = url_for( 'confirm_email',token=token, _external=True)
    html = render_template( 'email/activate.html', confirm_url=confirm_url)
    send_email(user.email, subject, html)

    return '{ "status" : 200 }'

@app.route('/api/login',methods=['GET','POST'])
def login():   
    email = request.form['email']
    password = request.form['password']
    remember_me = False
    if 'remember_me' in request.form:
        remember_me = True
    registered_user = User.query.filter(User.email==email).first()
    if registered_user is None:
        flash('Username is invalid' , 'error')
        return redirect(url_for('login'))
    if not registered_user.check_password(password):
        return redirect(url_for('login'))
    login_user(registered_user, remember = remember_me)
    session['user_email'] = email
    return "ok"

@app.route('/api/getUserData', methods=['GET','POST'])
def get_user_data():
    email = session['user_email']
    registered_user = User.query.filter(User.email==email).first()
    user = {}
    time_since_registration =  registered_user.registered_on - datetime.utcnow() 
    days_left_in_free_trial = max(0, 7 - abs( time_since_registration.days ) )
    if days_left_in_free_trial == 0:
        session['lock_account'] = True
        user["locked"] = True
    else:
        session['lock_account'] = False
        
    user['days_left_in_free_trial'] = days_left_in_free_trial
    user['email'] = registered_user.email
    user = get_customer_info( user );

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

from flask import request
import tweepy

auth_twitter_session = dict()
db_twitter = dict() #you can save these values to a database
TWITTER_API = None 

@app.route("/api/authtwitter",  methods = ['POST', 'GET'] )
def send_token():
    if session['lock_account']:
        session['lock_account'] = True

    auth = tweepy.OAuthHandler(CONSUMER_TOKEN, 
                               CONSUMER_SECRET )

    #raise Exception( auth.request_token )

    try: 
		#get the request tokens
        redirect_url= auth.get_authorization_url()
        session['request_token'] = auth.request_token
        #auth_twitter_session['request_token'] = auth.request_token
    except tweepy.TweepError:
        print 'Error! Failed to get request token'

    data = { 'redirect_url' : redirect_url }
    data = json.dumps( data )

    return data
    
@app.route("/verify")
def get_verification():
    token = session['request_token']
    verifier= request.args['oauth_verifier']
    auth = tweepy.OAuthHandler(CONSUMER_TOKEN, 
                               CONSUMER_SECRET )
    auth.request_token = token
    auth.get_access_token(verifier)

    auth.set_access_token( auth.access_token, auth.access_token_secret)
    TWITTER_API = tweepy.API(auth, parser=tweepy.parsers.JSONParser() )
    user_info = TWITTER_API.me()
    twitter_user_id = user_info['id_str']
    
    if len( User.query.filter( User.twitter_user_id == twitter_user_id ).all() ) > 0:
        return redirect( BASE_URL + '/#/dashboard?error=tw_user_already_registered')


    user = User.query.filter( User.id == g.user.id ).first()
    user.twitter_user_id = twitter_user_id
    db.session.commit()
    
    twitter_auth = TwitterAuth( auth.access_token, auth.access_token_secret, g.user.id, twitter_user_id )
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
    if session['lock_account'] == True:
        return json.dumps( {} )

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
    if session['lock_account'] == True:
        return json.dumps( {} )
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
    req = request.get_json()
    token = req['token']
    stripe.api_key = 'sk_test_F4XR1cnPuvLDX5nDk4VbjIhX'
    customer = stripe.Customer.create(
        card=token,
        description= g.user.email
    )
    stripe_customer = StripeCustomer( customer.id, g.user.id, customer.cards.data[0].brand, customer.cards.data[0].last4   )
    db.session.add( stripe_customer )
    db.session.commit()

    customer = stripe.Customer.retrieve( customer.id )
    customer.subscriptions.create(plan="basic")

    return json.dumps( customer )

@app.route("/api/stripe/subscribeCustomer", methods=['GET', 'POST'])
def subscribe_customer():
    # suscribed existing customer to a plan ( this typically means resuscribing )
    stripe_customer_id  = StripeCustomer.query.filter( StripeCustomer.user_id == g.user.id ).first().stripe_customer_id
    stripe.api_key = 'sk_test_F4XR1cnPuvLDX5nDk4VbjIhX'
    customer = stripe.Customer.retrieve( stripe_customer_id )
    if customer.subscriptions.total_count > 0:
        customer.subscriptions.retrieve( customer.subscriptions.data[0].id ).delete()

    customer.subscriptions.create(plan="basic")
    return json.dumps( customer )


@app.route("/api/stripe/updateCard", methods=['GET', 'POST'])
def update_card():
    req = request.get_json()
    token = req['token']
    stripe_customer_id  = StripeCustomer.query.filter( StripeCustomer.user_id == g.user.id ).first().stripe_customer_id
    stripe.api_key = 'sk_test_F4XR1cnPuvLDX5nDk4VbjIhX'
    customer = stripe.Customer.retrieve( stripe_customer_id )
    customer.card = token
    customer.save()

    stripe_customer = StripeCustomer.query.filter( StripeCustomer.user_id == g.user.id ).first()
    stripe_customer.card_last4 = customer.cards.data[0].last4 
    stripe_customer.card_brand =  customer.cards.data[0].brand
    db.session.commit()

    return json.dumps( customer )

@app.route("/api/stripe/cancelSubscription", methods=['GET', 'POST'])
def cancel_subscription():
    stripe.api_key = "sk_test_F4XR1cnPuvLDX5nDk4VbjIhX"
    stripe_customer_id  = StripeCustomer.query.filter( StripeCustomer.user_id == g.user.id ).first().stripe_customer_id
    customer = stripe.Customer.retrieve( stripe_customer_id )        
    customer.subscriptions.retrieve( customer.subscriptions.data[0].id ).delete()
    return "ok"

@app.route("/api/stripe/getCustomerInfo", methods=['GET', 'POST'])
def get_customer_info( userData ):
    stripe_customer  = StripeCustomer.query.filter( StripeCustomer.user_id == g.user.id ).first()
    if stripe_customer:
        stripe.api_key = "sk_test_F4XR1cnPuvLDX5nDk4VbjIhX"
        customer = stripe.Customer.retrieve( stripe_customer.stripe_customer_id )
    else:
        return userData

    subscribed = False
    if customer.subscriptions.total_count > 0:
        subscribed = True
        session['lock_account'] = False
  #  res = {}
    if stripe_customer:
    #    res['data'] = {}
    #    res['data']["card_last4"] = stripe_customer.card_last4
    #    res['data']["card_brand"] = stripe_customer.card_brand
    #    res['data']['subscribed'] = subscribed;
   
        userData["card_last4"] = stripe_customer.card_last4
        userData["card_brand"] = stripe_customer.card_brand
        userData['subscribed'] = subscribed; 
        if userData['subscribed']:
            userData["locked"] = False;
  #  else:
  #      res['data'] = None; 
  #  res = json.dumps( res )
    return userData

def send_email( email, subject, html):
    msg = Message(
        subject,
        sender='info@cnkt.co',
        recipients=
        [ email ])
    msg.body = html
    mail.send(msg)
    return "Sent"


@app.route('/confirm/<token>')
def confirm_email(token):
    try:
        email = ts.loads(token, salt="email-confirm-key", max_age=86400)
    except:
        abort(404)

    user = User.query.filter_by(email=email).first_or_404()
    user.email_confirmed = True

    db.session.add(user)
    db.session.commit()

    data = {'status':200 }
    data = json.dumps( data )

    return data


@app.route('/reset', methods=["GET", "POST"])
def reset():
    email = request.args['email']
    user = User.query.filter(User.email == email).first()
    if not user:
        return json.dumps( { 'error': 'user not found' } ) 
    subject = "Password reset requested"
    token = ts.dumps(email, salt='recover-key')
    recover_url = url_for( 'reset_with_token', token=token, _external=True)        
    html = render_template( 'email/recover.html', recover_url=recover_url)
    send_email(user.email, subject, html)
    return json.dumps( { 'status': 'success' } )

@app.route('/reset/<token>', methods=["GET", "POST"])
def reset_with_token(token):
    req = request.get_json()
    try:
        email = ts.loads(token, salt="recover-key", max_age=86400)
    except:
        abort(404)

    if req and req['from-reset-password-page']:
        user = User.query.filter(User.email==email).first()
        user.set_password( req['password'] )
        db.session.commit()
        return user.password
        
    data = {'status':200 }
    data = json.dumps( data )
        
    return render_template('marketing.html', email=email, token=token)

@app.route('/api/reset-password-logged-in', methods=["GET", "POST"])
def reset_password_logged_in():
    req = request.get_json()
    user = User.query.filter(User.email==g.user.email).first()
    user.set_password( req['password'] )
    db.session.commit()
    return "ok"

if __name__ == '__main__':
    app.run(debug=True)
