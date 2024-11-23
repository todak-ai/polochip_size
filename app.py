import os
from flask import Flask, render_template

app = Flask(__name__, static_folder='static')

@app.route('/')
def index():
    return render_template('index.html')

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))  # Render는 환경 변수로 포트를 설정함
    app.run(host='0.0.0.0', port=port, debug=False)  # debug=False 설정

