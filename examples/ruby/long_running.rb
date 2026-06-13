# Long-running counter loop — attach target for rdbg remote debugging.
# Start it listening for a debugger with:
#   rdbg --open --host 127.0.0.1 --port 12345 long_running.rb
# Then attach via the attach_to_process MCP tool.

counter = 0
message = 'tick'

loop do
  counter += 1
  squared = counter * counter
  puts "#{message} #{counter} (squared: #{squared})"
  sleep 1
end
