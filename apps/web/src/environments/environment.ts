export const environment = {
  production: false,
  apiBaseUrl: 'http://localhost:5080',
  githubRepo: 'SMARTSKA97/Zenigma',
  /**
   * Who made the app and how to support it. Everything here is public by nature (a Ko-fi page, a UPI id, a PayPal link), so it is
   * not a secret and does not go in GitHub secrets. Leave a value empty and that part is simply not shown.
   */
  support: {
    developer: { name: '', about: 'Made by one person, in spare time.', links: [] as { label: string; url: string }[] },
    kofiUrl: '',
    upiId: '',
    paypalUrl: '',
  },
};
