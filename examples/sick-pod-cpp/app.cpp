// Native "pricer" service for the sick-pod tutorial (docs/jit-diagnostics/).
//
// Same bug class as the Python checkout demo — a cached value corrupted in
// place by a rarely-taken code path — but in a compiled service with no
// in-process debug agent. The debugger reaches it via a Kubernetes ephemeral
// debug container sharing the pod's PID namespace (attach by PID).
//
// Line protocol on :8080 (one request per connection):
//   TOTAL <item>\n   -> price in cents
//   BULK <item>\n    -> bulk-discounted price in cents
//
// Compile with DWARF, no optimization (as the Dockerfile does):
//   g++ -std=c++17 -gdwarf-4 -O0 -o pricer app.cpp
#include <arpa/inet.h>
#include <netinet/in.h>
#include <sys/socket.h>
#include <unistd.h>

#include <cstdio>
#include <cstring>
#include <map>
#include <string>
#include <vector>

// Prices in cents
static const std::map<std::string, int> PRICES = {
    {"apple", 150}, {"banana", 75}, {"cherry", 300}};

// "Optimization": cache the price list for each distinct cart.
// The bug: build_cart returns a REFERENCE to the cached vector, and the bulk
// path mutates it in place — silently corrupting the cache for every later
// request for the same cart. Nothing is ever logged about it.
static std::map<std::string, std::vector<int>> g_cart_cache;

static std::vector<int>& build_cart(const std::string& item) {
    auto it = g_cart_cache.find(item);
    if (it == g_cart_cache.end()) {
        std::vector<int> prices;
        auto price = PRICES.find(item);
        prices.push_back(price == PRICES.end() ? 0 : price->second);
        it = g_cart_cache.emplace(item, std::move(prices)).first;
    }
    return it->second;
}

// 10% off any line >= $3.00 — but it mutates the (shared, cached) vector.
static int apply_bulk_discount(std::vector<int>& prices) {
    int total = 0;
    for (auto& price : prices) {
        if (price >= 300) {
            price = static_cast<int>(price * 0.9);
        }
        total += price;
    }
    return total;
}

static int checkout_total(const std::string& verb, const std::string& item) {
    std::vector<int>& prices = build_cart(item);
    if (verb == "BULK") {
        return apply_bulk_discount(prices);
    }
    int total = 0;
    for (int price : prices) {
        total += price;
    }
    return total;
}

int main() {
    int server_fd = socket(AF_INET, SOCK_STREAM, 0);
    if (server_fd < 0) {
        std::perror("socket");
        return 1;
    }
    int reuse = 1;
    setsockopt(server_fd, SOL_SOCKET, SO_REUSEADDR, &reuse, sizeof(reuse));

    sockaddr_in addr{};
    addr.sin_family = AF_INET;
    addr.sin_addr.s_addr = INADDR_ANY;
    addr.sin_port = htons(8080);
    if (bind(server_fd, reinterpret_cast<sockaddr*>(&addr), sizeof(addr)) < 0) {
        std::perror("bind");
        return 1;
    }
    if (listen(server_fd, 16) < 0) {
        std::perror("listen");
        return 1;
    }
    std::printf("pricer listening on :8080\n");
    std::fflush(stdout);

    for (;;) {
        int client_fd = accept(server_fd, nullptr, nullptr);
        if (client_fd < 0) {
            continue;
        }
        char buf[256];
        ssize_t n = read(client_fd, buf, sizeof(buf) - 1);
        if (n > 0) {
            buf[n] = '\0';
            std::string request(buf);
            while (!request.empty() &&
                   (request.back() == '\n' || request.back() == '\r')) {
                request.pop_back();
            }
            std::string verb = request.substr(0, request.find(' '));
            std::string item = request.size() > verb.size()
                                   ? request.substr(verb.size() + 1)
                                   : "";
            int total = checkout_total(verb, item);
            // Totals are never logged — that's the point of the tutorial.
            char response[32];
            int len = std::snprintf(response, sizeof(response), "%d\n", total);
            (void)!write(client_fd, response, static_cast<size_t>(len));
        }
        close(client_fd);
    }
}
