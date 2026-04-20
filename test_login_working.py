from app import app

with app.test_client() as client:
    # Get the login page
    resp = client.get('/login')
    print(f'Login page status: {resp.status_code}')
    if resp.status_code != 200:
        print('Failed to get login page')
        exit(1)
    
    # Extract CSRF token from the response data
    data = resp.data.decode('utf-8', errors='ignore')
    print(f'Page size: {len(data)} chars')
    
    # Look for the CSRF token input
    token_start = data.find('name="csrf_token"')
    if token_start == -1:
        print('CSRF token not found in login page')
        # Show what we have around forms
        form_pos = data.find('<form')
        if form_pos != -1:
            print('Form found at position:', form_pos)
            print('Context:', data[max(0, form_pos-100):form_pos+300])
        exit(1)
    
    # Find the value attribute
    value_start = data.find('value="', token_start)
    if value_start == -1:
        print('value attribute not found after csrf_token')
        print('Context:', data[max(0, token_start-20):token_start+50])
        exit(1)
    value_start += len('value="')
    value_end = data.find('"', value_start)
    csrf_token = data[value_start:value_end]
    print(f'Extracted CSRF token (first 10 chars): {csrf_token[:10]}')
    
    # Prepare login data
    login_data = {
        'csrf_token': csrf_token,
        'username': 'superadmin',
        'password': 'admin123'
    }
    
    # Post the login form
    resp = client.post('/login', data=login_data, follow_redirects=False)
    print(f'Login response status: {resp.status_code}')
    print(f'Login response headers: {dict(resp.headers)}')
    
    # Check for redirect to dashboard
    if resp.status_code == 302 and '/dashboard' in resp.location:
        print('SUCCESS: Login successful, redirected to dashboard')
    else:
        print(f'Login failed. Status: {resp.status_code}')
        if resp.status_code == 200:
            print('Response contains error messages')
            if b'Invalid' in resp.data:
                print('Invalid credentials error')
            elif b'CSRF' in resp.data:
                print('CSRF validation error')
        else:
            print(f'Response data preview: {resp.data[:200]}')
