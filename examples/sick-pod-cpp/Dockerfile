FROM gcc:13 AS build
WORKDIR /src
COPY app.cpp .
# DWARF stays in the binary (no strip) — the ephemeral debug container's
# CodeLLDB symbolicates from it; -gdwarf-4 -O0 for faithful lines and locals.
RUN g++ -std=c++17 -gdwarf-4 -O0 -o /pricer app.cpp

FROM debian:12-slim
RUN apt-get update && \
    apt-get install -y --no-install-recommends libstdc++6 && \
    rm -rf /var/lib/apt/lists/*
COPY --from=build /pricer /pricer
EXPOSE 8080
# No debug agent, no debug port — native code has nothing in-process to
# listen. The debugger arrives later as a kubectl debug ephemeral container.
CMD ["/pricer"]
