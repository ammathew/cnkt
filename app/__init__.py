#!/usr/bin/env python
#from flask import Flask
#from flask.ext.login import LoginManager
#from flask.ext.cors import CORS
from flask import Flask
from flask.ext.sqlalchemy import SQLAlchemy
from flask.ext.login import LoginManager
from flask.ext.mail import Mail, Message

from itsdangerous import URLSafeTimedSerializer

app = Flask(__name__)
app.config.from_object('config')
mail=Mail(app)
ts = URLSafeTimedSerializer(app.config["SECRET_KEY"])

app.config.update(
    DEBUG=True,
    #EMAIL SETTINGS
    MAIL_SERVER='smtp.gmail.com',
    MAIL_PORT=465,
    MAIL_USE_SSL=True,
    MAIL_USERNAME = 'info@cnkt.co',
    MAIL_PASSWORD = 'apple001'
)

db = SQLAlchemy(app)
login_manager = LoginManager()
login_manager.init_app(app)
login_manager.login_view = 'login'
BASE_URL = 'http://www.cnkt.co'


from app import views
