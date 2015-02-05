import os
basedir = os.path.abspath(os.path.dirname(__file__))
SQLALCHEMY_DATABASE_URI = 'sqlite:///' + os.path.join(basedir, 'app.db')
SQLALCHEMY_MIGRATE_REPO = os.path.join(basedir, 'db_repository')

#SQLALCHEMY_DATABASE_URI = 'sqlite:///app.db'
#SQLALCHEMY_MIGRATE_REPO = os.path.join('db_repository')
SQLALCHEMY_ECHO = False
SECRET_KEY = 'secret_key'
DEBUG = True
