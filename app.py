from flask import Flask, request, jsonify, send_file
import requests
from bs4 import BeautifulSoup
import webbrowser
from threading import Timer, Thread
import signal
import sys

app = Flask(__name__)

# Function to search the web and return results
def search(query):
    search_url = f'https://www.google.com/search?q={query}'
    headers = {'User-Agent': 'Mozilla/5.0'}
    response = requests.get(search_url, headers=headers)
    soup = BeautifulSoup(response.text, 'html.parser')
    results = []
    for item in soup.select('.BNeawe'):
        results.append(item.get_text())
    return results[:5]  # Limit to top 5 results

# Route for the homepage
@app.route('/')
def index():
    # Replace 'index.html' with the path to your HTML file
    return send_file('Chatbot.html')

# Route to handle user queries
@app.route('/ask', methods=['POST'])
def ask_question():
    data = request.json
    query_type = data.get('queryType')
    user_message = data.get('message')
    if query_type == 'web':
        answers = search(user_message)
        return jsonify({'answers': answers})
    else:
        return jsonify({'error': 'Invalid query type'})

# Function to open Edge browser automatically
def open_browser():
    webbrowser.get('windows-default').open('http://127.0.0.1:5001')

# Function to handle server shutdown
def shutdown_server():
    print('Shutting down the Flask server...')
    func = request.environ.get('werkzeug.server.shutdown')
    if func is None:
        raise RuntimeError('Not running with the Werkzeug Server')
    func()

# Signal handler for graceful shutdown
def signal_handler(sig, frame):
    print('Signal received, shutting down server...')
    shutdown_server()
    sys.exit(0)

signal.signal(signal.SIGINT, signal_handler)
signal.signal(signal.SIGTERM, signal_handler)

if __name__ == '__main__':
    # Start the Flask server in a separate thread
    server_thread = Thread(target=lambda: app.run(debug=True, use_reloader=False, port=5001))
    server_thread.start()

    # Open the browser after a short delay
    Timer(1, open_browser).start()

    # Wait for the server thread to complete
    try:
        server_thread.join()
    except KeyboardInterrupt:
        print("KeyboardInterrupt received. Stopping the server.")
        shutdown_server()
