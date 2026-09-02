import os

bind = f"0.0.0.0:{os.environ.get('PORT', '5000')}"
workers = int(os.environ.get('WEB_CONCURRENCY', 1))
worker_class = os.environ.get('GUNICORN_WORKER_CLASS', 'eventlet')
timeout = 120
keepalive = 5
threads = 4
loglevel = os.environ.get('LOG_LEVEL', 'info')
accesslog = '-'
errorlog = '-'
