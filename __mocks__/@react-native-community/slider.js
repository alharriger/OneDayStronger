// Mock for @react-native-community/slider — not installed as a native module;
// replaced with a no-op View for tests.
const React = require('react');
const { View } = require('react-native');
const Slider = (props) => React.createElement(View, props);
module.exports = Slider;
module.exports.default = Slider;
