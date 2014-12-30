#!/home2/thezeith/public_html/cnkt/flask/bin/python

from flup.server.fcgi import WSGIServer
from app import app as application

WSGIServer(application).run()
