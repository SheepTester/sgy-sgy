import json;
from flask import Flask;
from flask import request;
from requests_oauthlib import OAuth1Session;
app = Flask(__name__);

request_tokens = {};
access_tokens = {};

apiBase = 'https://api.schoology.com/v1';
sgyDomain = 'https://pausd.schoology.com';

class Token:
    def __init__(self, key, secret):
        self.key = key;
        self.secret = secret;

    def oauth_session(self, token=None):
        return OAuth1Session(
            self.key,
            client_secret=self.secret,
            resource_owner_key=token and token.key,
            resource_owner_secret=token and token.secret
        );

    @staticmethod
    def from_json(json):
        return Token(json['key'], json['secret']);

with open('api-creds.json') as f:
    consumer = Token.from_json(json.load(f));

@app.route('/')
def hello_world():
    user_id = request.args.get('whomst');
    token = access_tokens.get(user_id);
    if token is None:
        return consumer.oauth_session(consumer).get('https://httpbin.org/get').json();
    else:
        pass;
