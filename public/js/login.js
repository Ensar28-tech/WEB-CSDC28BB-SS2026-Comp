// Login and registration. Both forms work the same way: send the two fields,
// keep the token the server answers with, then go to the search page.
import { api, renderNav, saveLogin, showMessage } from './common.js';

renderNav();
setUpForm('#login-form', '/api/auth/login');
setUpForm('#register-form', '/api/auth/register');

function setUpForm(selector, url) {
  const form = document.querySelector(selector);
  form.addEventListener('submit', async (event) => {
    event.preventDefault(); // don't reload the page: we send the data ourselves
    const fields = new FormData(form);
    try {
      const { token, user } = await api('POST', url, {
        username: fields.get('username'),
        password: fields.get('password'),
      });
      saveLogin(token, user);
      location.href = 'index.html';
    } catch (error) {
      showMessage(error.message, 'error');
    }
  });
}
