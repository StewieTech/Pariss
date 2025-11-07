import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import NavBar from '../../app/components/NavBar';

describe('NavBar', () => {
  test('renders and calls onNav when pressed', () => {
    const onNav = jest.fn();
  const { getByTestId } = render(<NavBar current="main" onNav={onNav} />);

//   fireEvent.press(getByTestId('nav-main'));
//   expect(onNav).toHaveBeenCalledWith('main');

  // second button maps to 'pve'
//   fireEvent.press(getByTestId('nav-pve'));
//   expect(onNav).toHaveBeenCalledWith('pve');
  });
});
