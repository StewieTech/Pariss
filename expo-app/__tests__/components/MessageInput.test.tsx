import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import MessageInput from '../../app/components/MessageInput';

describe('MessageInput', () => {
  it('calls onSend when send pressed', () => {
    const onSend = jest.fn();
    const onChange = jest.fn();
    const { getByText } = render(<MessageInput value="" onChange={onChange} onSend={onSend} />);
    fireEvent.press(getByText('Send'));
    expect(onSend).toHaveBeenCalled();
  });
});
