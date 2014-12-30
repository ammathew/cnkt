#!/usr/bin/env python
#from flask import Flask
#from flask.ext.login import LoginManager
#from flask.ext.cors import CORS

#app = Flask(__name__, template_folder="templates" )
#cors = CORS(app)

#app.config.from_object('config')

#login_manager = LoginManager()
#login_manager.init_app(app)
#login_manager.login_view = 'login'


#BASE_URL = 'http://www.cnkt.co'


from flask import Flask
from flask.ext.sqlalchemy import SQLAlchemy
from flask.ext.login import LoginManager

app = Flask(__name__)
app.config.from_object('config')
db = SQLAlchemy(app)
login_manager = LoginManager()
login_manager.init_app(app)
login_manager.login_view = 'login'
BASE_URL = 'http://www.cnkt.co'


from app import views
