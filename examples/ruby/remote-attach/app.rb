# Long-running worker — remote-attach demo target.
# Runs inside a container under rdbg with a TCP DAP listener:
#   rdbg --open --host 0.0.0.0 --port 12345 --nonstop app.rb
# --nonstop lets the app run immediately; a debugger can attach at any time.

require 'time'

orders = []
revenue = 0.0
tick = 0

loop do
  tick += 1
  order = { id: tick, amount: (tick % 7 + 1) * 1.5, at: Time.now.utc.iso8601 }
  orders << order
  orders.shift if orders.size > 10
  revenue += order[:amount]
  puts "processed order #{order[:id]} amount=#{order[:amount]} revenue=#{revenue.round(2)}"
  $stdout.flush
  sleep 2
end
