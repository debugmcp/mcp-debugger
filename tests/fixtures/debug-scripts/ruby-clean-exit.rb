# Minimal clean-exit fixture (issue #258): prints and exits 0. The session
# must end in state 'stopped' with exitCode 0, not 'error'.
puts 'ruby clean start'
puts 'ruby clean done'
