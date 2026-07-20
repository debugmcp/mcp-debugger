FROM ruby:4.0-slim@sha256:abd7528c4df35d151e2643d5efb845e442a26e36a4babc6459bee508619137a2
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
