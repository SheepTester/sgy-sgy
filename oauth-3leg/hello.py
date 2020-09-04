import json;
from flask import Flask, request, redirect, url_for, send_file ;
from requests_oauthlib import OAuth1Session;
from urllib.parse import parse_qs, urlencode;
app = Flask(__name__);

request_tokens = {};
access_tokens = {};

api_base = 'https://api.schoology.com/v1';
sgy_domain = 'https://pausd.schoology.com';

class Token:
    def __init__(self, key, secret):
        self.key = key;
        self.secret = secret;
        self.session_cache = {};

    def oauth_session(self, token=None):
        return self.session_cache.get(token) or OAuth1Session(
            self.key,
            client_secret=self.secret,
            resource_owner_key=token and token.key,
            resource_owner_secret=token and token.secret
        );

    def __hash__(self):
        return hash((self.key, self.secret));

    @staticmethod
    def from_json(json):
        return Token(json['key'], json['secret']);

    @staticmethod
    def from_sgy(json):
        return Token(json['oauth_token'][0], json['oauth_token_secret'][0]);

with open('api-creds.json') as f:
    consumer = Token.from_json(json.load(f));

@app.route('/')
def hello_world():
    user_id = request.args.get('whomst');
    if not user_id:
        return send_file('./whomst.html');
    token = access_tokens.get(user_id);
    if token is None:
        oauth_token = request.args.get('oauth_token');
        if oauth_token:
            request_token = request_tokens.get(user_id);
            if request_token is None:
                return ('i forgot about you! :)', 401);
            if request_token.key != oauth_token:
                return ('"someone\'s tampering with requests" -sgy', 401);
            api_result = parse_qs(
                consumer.oauth_session(request_token)
                    .get(api_base + '/oauth/access_token')
                    .text
            );
            token = Token.from_sgy(api_result);
            access_tokens[user_id] = token;
            new_args = request.args.copy();
            new_args.pop('oauth_token');
            return redirect('?' + urlencode(new_args));
        else:
            result = parse_qs(
                consumer.oauth_session()
                    .get(api_base + '/oauth/request_token')
                    .text
            );
            oauth_token = Token.from_sgy(result);
            request_tokens[user_id] = oauth_token;
            return redirect(sgy_domain + '/oauth/authorize?' + urlencode({
                'oauth_callback': request.url,
                'oauth_token': oauth_token.key
            }));
    else:
        response = consumer.oauth_session(token).get(api_base + '/users/me');
        if not response.ok:
            access_tokens.remove(user_id);
            return ('token no longer valid :( -- ' + response.text, 401);

    session = consumer.oauth_session(token);
    user = session.get(api_base + '/users/me').json();
    sgy_id = user['id'];
    api_result = session.get(api_base + '/users/%s/sections' % sgy_id).json();
    return '<h4>Courses</h4><ul>%s</ul>' % (''.join(
        '<li>%s: %s</li>' % (section['course_title'], section['section_title']) for section in api_result['section']
    ) or '<li>No courses were found for this user.</li>');

@app.route('/test')
def test():
    return '<br>'.join([
        url_for('hello_world'),
        request.url
    ]);
