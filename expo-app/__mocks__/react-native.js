// Minimal React Native manual mock for Jest component tests
const React = require('react');

function mapProps(p) {
  const np = Object.assign({}, p);
  if (np && np.testID) {
    np['data-testid'] = np.testID;
  }
  // React DOM doesn't need testID
  delete np.testID;
  return np;
}

const Text = (props) => React.createElement('text', mapProps(props), props.children);
const View = (props) => React.createElement('div', mapProps(props), props.children);
const TouchableOpacity = (props) => React.createElement('button', mapProps(props), props.children);

const StyleSheet = {
  create: (styles) => styles,
  flatten: (style) => {
    if (Array.isArray(style)) {
      return Object.assign({}, ...style.filter(Boolean));
    }
    return style || {};
  },
};

module.exports = {
  Text,
  View,
  TouchableOpacity,
  StyleSheet,
  Platform: { OS: 'android' },
  // minimal Animated stub
  Animated: {
    Value: function () {},
  },
};
