import * as SMS from 'expo-sms';
import { sendSOS } from '../services/sendSOS';

jest.mock('expo-sms');

describe('sendSOS', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('calls sendSMSAsync with correct args when SMS is available', async () => {
    SMS.isAvailableAsync.mockResolvedValue(true);
    SMS.sendSMSAsync.mockResolvedValue({ result: 'sent' });

    await sendSOS();

    expect(SMS.sendSMSAsync).toHaveBeenCalledTimes(1);
    expect(SMS.sendSMSAsync).toHaveBeenCalledWith(
      [],
      'I need help. Please track my location.'
    );
  });

  it('does not call sendSMSAsync when SMS is unavailable', async () => {
    SMS.isAvailableAsync.mockResolvedValue(false);

    await expect(sendSOS()).resolves.toBeUndefined();
    expect(SMS.sendSMSAsync).not.toHaveBeenCalled();
  });

  it('swallows errors thrown by isAvailableAsync without rethrowing', async () => {
    SMS.isAvailableAsync.mockRejectedValue(new Error('SMS module crashed'));

    await expect(sendSOS()).resolves.toBeUndefined();
  });

  it('swallows errors thrown by sendSMSAsync without rethrowing', async () => {
    SMS.isAvailableAsync.mockResolvedValue(true);
    SMS.sendSMSAsync.mockRejectedValue(new Error('User cancelled'));

    await expect(sendSOS()).resolves.toBeUndefined();
  });
});
