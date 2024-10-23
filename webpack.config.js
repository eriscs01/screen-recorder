const path = require('path');

module.exports = {
    entry: path.resolve(__dirname, 'public', 'script.js'),
    output: {
        filename: 'bundle.js',
        path: path.resolve(__dirname, 'public', 'dist')
    }
};

