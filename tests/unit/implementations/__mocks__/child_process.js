// Manual mock for child_process
const spawn = jest.fn();
const exec = jest.fn();

module.exports = {
  spawn,
  exec
};
