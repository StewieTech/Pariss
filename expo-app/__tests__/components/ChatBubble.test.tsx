import React from 'react';
import { render } from '@testing-library/react-native';
import ChatBubble from '../../app/components/ChatBubble';

describe('ChatBubble', () => {
  it('renders assistant bubble and user bubble', () => {
    const { toJSON: a } = render(<ChatBubble author="assistant" text="hello" />);
    const { toJSON: u } = render(<ChatBubble author="user" text="hi" />);
    expect(a()).toMatchSnapshot();
    expect(u()).toMatchSnapshot();
  });
});
