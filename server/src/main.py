import io
import os
from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
from PIL import Image
import win32clipboard
from io import BytesIO

# import numpy as np
# import screenpoint 
import pyautogui 
import pygetwindow 
import pyscreenshot
import requests  
import time 
# from datetime import datetime
import logging
import argparse 

# import ps

logging.basicConfig(level=logging.INFO)

parser = argparse.ArgumentParser()
# parser.add_argument('--photoshop_password', default='123456')
parser.add_argument('--basnet_service_ip', required=True, help="The BASNet service IP address")
parser.add_argument('--basnet_service_host', help="Optional, the BASNet service host")
args = parser.parse_args()

max_view_size = 700
max_screenshot_size = 400

app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "*"}})


@app.route('/', methods=['GET'])
def hello():
    return 'welcome to Backend!'

@app.route('/ping', methods=['GET'])
def ping():
    logging.info('ping')
    r = requests.get(args.basnet_service_ip, headers={'Host': args.basnet_service_host})
    logging.info(f'pong: {r.status_code} {r.content}')
    return 'pong'

@app.route('/cut', methods=['POST'])
def save():
    start = time.time()
    logging.info(' CUT')
    data1 = request.files.get('data', None)
    logging.info(' data : ' + str(data1))
    if 'data' not in request.files:
        return jsonify({
            'status': 'error',
            'error': 'missing file param `data`'
        }), 400
    data = request.files['data'].read()
    if len(data) == 0:
        return jsonify({'status:': 'error', 'error': 'empty image'}), 400

    with open('cut_received.jpg', 'wb') as f:
        f.write(data)

    logging.info(' > sending to BASNet...')
    headers = {}
    if args.basnet_service_host is not None:
        headers['Host'] = args.basnet_service_host
    files= {'data': open('cut_received.jpg', 'rb')} 
    res = requests.post(args.basnet_service_ip, headers=headers, files=files )

    logging.info(' > saving results...')
    with open('cut_mask.png', 'wb') as f:
        f.write(res.content)

    logging.info(' > opening mask...')
    mask = Image.open('cut_mask.png').convert("L").resize((256,256),resample=Image.BICUBIC, reducing_gap=2.0)

    logging.info('compositing final image...')
    ref = Image.open(io.BytesIO(data))
    empty = Image.new("RGBA", ref.size, 0)
    img = Image.composite(ref, empty, mask)

    img_scaled = img.resize((img.size[0] * 3, img.size[1] * 3))

    logging.info('saving final image...')
    img_scaled.save('cut_current.png')

    buff = io.BytesIO()
    img.save(buff, 'PNG')
    buff.seek(0)

    logging.info(f'Completed in {time.time() - start:.2f}s')
    logging.info('check final image : %s', buff)

    return send_file(buff, mimetype='image/png')

@app.route('/paste', methods=['POST'])
def paste():
    start = time.time()
    logging.info('PASTE')

    if 'data' not in request.files:
        return jsonify({'status': 'error', 'error': 'missing file param `data`'}), 400
    data = request.files['data'].read()
    if len(data) == 0:
        return jsonify({'status': 'error', 'error': 'empty image'}), 400

    with open('paste_received.png', 'wb') as f:
        f.write(data)

    logging.info('> loading image...')
    view = Image.open(io.BytesIO(data))

    if view.size[0] > max_view_size or view.size[1] > max_view_size:
        view.thumbnail((max_view_size, max_view_size))

    logging.info('> grabbing screenshot...')
    screen = pyscreenshot.grab()
    screen_width, screen_height = screen.size

    if screen.size[0] > max_screenshot_size or screen.size[1] > max_screenshot_size:
        screen.thumbnail((max_screenshot_size, max_screenshot_size))

    logging.info('> finding projected point...')
    x, y = screen.size[0] / 2, screen.size[1] / 2

    if x != -1 and y != -1:
        x = int(x / screen.size[0] * screen_width)
        y = int(y / screen.size[1] * screen_height)
        logging.info(f'{x}, {y}')

        send_to_clipboard(data)

        active_window = pygetwindow.getWindowsWithTitle(pygetwindow.getActiveWindowTitle())[0]

        logging.info(f'> simulating paste into {active_window.title}...')
        active_window.activate()
        time.sleep(1) 
        pyautogui.click(active_window.left + x, active_window.top + y)
        pyautogui.hotkey('ctrl', 'v')
    else:
        logging.info('Screen not found')

    logging.info(f'Completed in {time.time() - start:.2f}s')
    return jsonify({'status': 'ok'})

def send_to_clipboard(image_data):
    image = Image.open(BytesIO(image_data))
    output = BytesIO()
    image.save(output, format="PNG")
    data = output.getvalue()
    output.close()

    win32clipboard.OpenClipboard()
    win32clipboard.EmptyClipboard()
    # format for PNG
    win32clipboard.SetClipboardData(win32clipboard.RegisterClipboardFormat("PNG"), data)
    win32clipboard.CloseClipboard()

if __name__ == '__main__':
    os.environ['FLASK_DEBUG'] = 'development'
    port = int(os.environ.get('PORT', 8080))
    # app.run(debug=True, host='192.168.43.242', port=port)
    app.run(debug=True, host='0.0.0.0', port=port)
    # app.run(debug=True, host='192.168.43.242', port=port)
