from datetime import datetime
from flask import Flask, request, jsonify, render_template
from flask.ext.sqlalchemy import SQLAlchemy
#db = SQLAlchemy(app)
from werkzeug.security import generate_password_hash, check_password_hash
from flask import Flask
from flask.ext.sqlalchemy import SQLAlchemy
from flask.ext.script import Manager
from flask.ext.migrate import Migrate, MigrateCommand
from app import db

class User(db.Model):
    __tablename__ = "users"
    id = db.Column('user_id',db.Integer , primary_key=True)
    password = db.Column('password' , db.String(250))
    email = db.Column('email',db.String(50),unique=True , index=True)
    registered_on = db.Column('registered_on' , db.DateTime)

    def __init__(self , email, password ):
        self.email = email
        self.set_password(password)
        self.registered_on = datetime.utcnow()

    def set_password(self , password):
        self.password = generate_password_hash(password)

    def check_password(self , password):
        return check_password_hash(self.password , password)

    def is_authenticated(self):
        return True

    def is_active(self):
        return True

    def is_anonymous(self):
        return False

    def get_id(self):
        return unicode(self.id)

    def __repr__(self):
        return '<User %r>' % (self.username)

class TwitterAuth(db.Model):
    __tablename__ = 'twitter_auth'
    id = db.Column('twitter_auth_id', db.Integer, primary_key=True)
    access_token_key = db.Column(db.String)
    access_token_secret = db.Column(db.String)
    user_id = db.Column(db.Integer, db.ForeignKey('users.user_id'))
    twitter_user_id = db.Column(db.String)
    first_authorized_on =  db.Column( db.DateTime)

    def __init__(self, access_token_key, access_token_secret, user_id, twitter_user_id, first_authorized_on):
        self.access_token_key = access_token_key
        self.access_token_secret = access_token_secret
        self.user_id = user_id
        self.twitter_user_id = twitter_user_id
        self.first_authorized_on = first_authorized_on

class StripeCustomer(db.Model):
    __tablename__ = 'stripe_customers'
    id = db.Column('customer_id', db.Integer, primary_key=True)
    stripe_customer_id = db.Column(db.String)
    user_id = db.Column(db.Integer, db.ForeignKey('users.user_id'))
    card_brand = db.Column(db.String)
    card_last4 = db.Column(db.String)
    
    def __init__(self, stripe_customer_id, user_id, card_brand, card_last4 ):
        self.stripe_customer_id = stripe_customer_id
        self.user_id = user_id
        self.card_brand = card_brand
        self.card_last4 = card_last4

if __name__ == '__main__':
    manager.run()
