from http.server import HTTPServer, BaseHTTPRequestHandler
import subprocess, os

class Handler(BaseHTTPRequestHandler):
    def do_HEAD(self):
        if self.path.startswith('/screenshot') or self.path.startswith('/health'):
            self.send_response(200)
            self.send_header('Content-Type', 'image/jpeg' if self.path.startswith('/screenshot') else 'application/json')
            self.end_headers()
        else:
            self.send_response(404)
            self.end_headers()

    def do_GET(self):
        if self.path.startswith('/health'):
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(b'{"status":"ok"}')
            return
        if self.path.startswith('/screenshot'):
            try:
                subprocess.run(
                    ['docker', 'exec', 'cloudcore-ai-vexa-1', 'ffmpeg', '-y', '-f', 'x11grab', '-i', ':99.0', '-frames:v', '1', '-update', '1', '/tmp/live_shot.jpg'],
                    check=True, timeout=5, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL
                )
                img = subprocess.check_output(['docker', 'exec', 'cloudcore-ai-vexa-1', 'cat', '/tmp/live_shot.jpg'])
                self.send_response(200)
                self.send_header('Content-Type', 'image/jpeg')
                self.send_header('Content-Length', str(len(img)))
                self.send_header('Cache-Control', 'no-cache, no-store, must-revalidate')
                self.end_headers()
                self.wfile.write(img)
                return
            except Exception as e:
                self.send_response(500)
                self.send_header('Content-Type', 'text/plain')
                self.end_headers()
                self.wfile.write(str(e).encode())
                return
        self.send_response(404)
        self.end_headers()

    def log_message(self, format, *args):
        pass

if __name__ == '__main__':
    server = HTTPServer(('127.0.0.1', 8057), Handler)
    server.serve_forever()
