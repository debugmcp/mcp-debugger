# Simple FizzBuzz example for debugging
# Usage: set a breakpoint inside fizzbuzz_for and step through

def fizzbuzz_for(n)
  label = ''
  label += 'Fizz' if (n % 3).zero?
  label += 'Buzz' if (n % 5).zero?
  label = n.to_s if label.empty?
  label
end

def main
  results = []
  (1..15).each do |i|
    value = fizzbuzz_for(i)
    results << value
    puts "#{i}: #{value}"
  end
  results
end

main
