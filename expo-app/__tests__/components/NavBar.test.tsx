import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import NavBar from '../../app/components/NavBar';

describe('NavBar', () => {
  it('renders and calls onNav', () => {
    const onNav = jest.fn();
    const { getByTestId } = render(<NavBar current="main" onNav={onNav} />);
    fireEvent.press(getByTestId('nav-pve'));
    expect(onNav).toHaveBeenCalledWith('pve');
  });
});

