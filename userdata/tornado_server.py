import tornado.ioloop
import tornado.web
from tornado.log import enable_pretty_logging, app_log, access_log, gen_log
import logging
import os

port = int(os.environ.get('PORT', '80'))
logfile = os.environ.get('LOGFILE')

if logfile:
    handler = logging.FileHandler(logfile)
    enable_pretty_logging()
    app_log.addHandler(handler)
    access_log.addHandler(handler)
    gen_log.addHandler(handler)

class MainHandler(tornado.web.RequestHandler):
    def get(self):
        app_log.info("MainHandle")
        self.write("Hello, I am Tornado.")

def make_app():
    return tornado.web.Application([
        (r"/", MainHandler),
    ])

if __name__ == "__main__":
    app = make_app()
    app.listen(port)
    tornado.ioloop.IOLoop.current().start()