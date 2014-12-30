import os
SQLALCHEMY_DATABASE_URI = 'sqlite:///app.db'
SQLALCHEMY_MIGRATE_REPO = os.path.join('db_repository')
SQLALCHEMY_ECHO = False
SECRET_KEY = 'secret_key'
DEBUG = True
