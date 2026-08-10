FROM ruby:4.0-slim@sha256:607bf92fa7ecebb4a0c6654b62cb44c48d94b36b6f5a754611ddbbe3dc5b6135
# Ruby >= 3.1 bundles the debug gem (rdbg) — no extra install needed,
# which keeps the slim image free of a C toolchain.

WORKDIR /app
COPY app.rb .

EXPOSE 12345

# --host 0.0.0.0 so the listener is reachable through the container's port
# mapping; --nonstop so the app runs without waiting for a debugger.
# SECURITY: the rdbg DAP socket is unauthenticated. Never publish it beyond
# localhost port mappings, kubectl port-forward, or an SSH tunnel.
CMD ["rdbg", "--open", "--host", "0.0.0.0", "--port", "12345", "--nonstop", "app.rb"]
