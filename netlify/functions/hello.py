import sys
import json
import os
from io import BytesIO

sys.path.insert(0, '.')
os.environ.setdefault('FLASK_ENV', 'production')

from app import app as flask_app

def handler(event, context):
    """Netlify function handler for Flask"""
    # Parse the incoming event
    http_method = event.get('httpMethod', 'GET')
    raw_path = event.get('path', '/')
    # Remove /.netlify/functions/hello prefix if present
    if '/.netlify/functions/hello' in raw_path:
        path = raw_path.split('/.netlify/functions/hello', 1)[-1] or '/'
        if not path:
            path = '/'
    else:
        path = raw_path
    headers = event.get('headers', {})
    query_params = event.get('queryStringParameters', {}) or {}
    body = event.get('body', '') or ''
    
    # Build query string
    query_string = '&'.join(f'{k}={v}' for k, v in query_params.items())
    
    # Create WSGI environment
    environ = {
        'REQUEST_METHOD': http_method,
        'PATH_INFO': path,
        'QUERY_STRING': query_string,
        'SERVER_NAME': headers.get('Host', 'localhost'),
        'SERVER_PORT': headers.get('X-Forwarded-Port', '443'),
        'HTTP_HOST': headers.get('Host', 'localhost'),
        'wsgi.url_scheme': 'https',
        'wsgi.input': BytesIO(body.encode() if body else b''),
        'wsgi.errors': sys.stderr,
        'CONTENT_TYPE': headers.get('Content-Type', ''),
    }
    
    # Add headers
    for key, value in headers.items():
        key_upper = key.upper().replace('-', '_')
        if key_upper not in ('CONTENT_TYPE', 'CONTENT_LENGTH'):
            environ[f'HTTP_{key_upper}'] = value
    
    # Create response collector
    response_started = []
    response_headers = []
    
    def start_response(status, headers):
        response_started.append(status)
        for k, v in headers:
            if k.lower() == 'content-type':
                response_headers.append(('contentType', v))
            elif k.lower() == 'content-length':
                response_headers.append(('contentLength', v))
            else:
                response_headers.append((k, v))
        return lambda x: None
    
    # Run the application
    response_body = b''.join(flask_app(environ, start_response))
    status = response_started[0] if response_started else '200 OK'
    status_code = int(status.split()[0])
    
    # Build response
    response = {
        'statusCode': status_code,
        'headers': {k: v for k, v in response_headers},
        'body': response_body.decode('utf-8')
    }
    
    return response