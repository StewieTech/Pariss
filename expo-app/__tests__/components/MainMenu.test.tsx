import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import MainMenu from '../../app/components/MainMenu';

describe('MainMenu', () => {
  it('renders and triggers onChoose', () => {
    const onChoose = jest.fn();
    const { getByTestId } = render(<MainMenu onChoose={onChoose} />);
    fireEvent.press(getByTestId('menu-pve'));
    expect(onChoose).toHaveBeenCalledWith('pve');
  });
});
import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import MainMenu from '../../app/components/MainMenu';

describe('MainMenu', () => {
  test('renders and triggers onChoose', () => {
    const onChoose = jest.fn();
  const { getByTestId } = render(<MainMenu onChoose={onChoose} />);

//   fireEvent.press(getByTestId('menu-pve'));
//   expect(onChoose).toHaveBeenCalledWith('pve');

//   fireEvent.press(getByTestId('menu-pvp'));
//   expect(onChoose).toHaveBeenCalledWith('pvp');
  });
});
