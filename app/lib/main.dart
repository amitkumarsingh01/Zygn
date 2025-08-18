import 'package:flutter/material.dart';
import 'package:local_auth/local_auth.dart';
import 'package:shared_preferences/shared_preferences.dart';

void main() {
  runApp(MyApp());
}

class MyApp extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Fingerprint Auth Demo',
      theme: ThemeData(
        primarySwatch: Colors.blue,
        visualDensity: VisualDensity.adaptivePlatformDensity,
      ),
      home: AuthPage(),
    );
  }
}

class AuthPage extends StatefulWidget {
  @override
  _AuthPageState createState() => _AuthPageState();
}

class _AuthPageState extends State<AuthPage> {
  final LocalAuthentication localAuth = LocalAuthentication();
  final TextEditingController _emailController = TextEditingController();
  final TextEditingController _passwordController = TextEditingController();
  
  bool _isLogin = true;
  bool _isAuthenticated = false;
  bool _canCheckBiometrics = false;
  String _authStatus = 'Not authenticated';
  
  @override
  void initState() {
    super.initState();
    _checkBiometrics();
    _checkAuthStatus();
  }

  Future<void> _checkBiometrics() async {
    bool canCheckBiometrics = false;
    try {
      canCheckBiometrics = await localAuth.canCheckBiometrics;
    } catch (e) {
      print('Error checking biometrics: $e');
    }
    
    setState(() {
      _canCheckBiometrics = canCheckBiometrics;
    });
  }

  Future<void> _checkAuthStatus() async {
    SharedPreferences prefs = await SharedPreferences.getInstance();
    bool isAuthenticated = prefs.getBool('isAuthenticated') ?? false;
    setState(() {
      _isAuthenticated = isAuthenticated;
      _authStatus = isAuthenticated ? 'Authenticated' : 'Not authenticated';
    });
  }

  Future<void> _authenticate() async {
    bool authenticated = false;
    try {
      authenticated = await localAuth.authenticate(
        localizedReason: 'Please authenticate to access the app',
        options: AuthenticationOptions(
          biometricOnly: false,
          stickyAuth: true,
        ),
      );
    } catch (e) {
      print('Error during authentication: $e');
      String errorMessage = 'Authentication error';
      
      if (e.toString().contains('no_fragment_activity')) {
        errorMessage = 'Configuration error: MainActivity needs to be updated. Check the setup instructions.';
      } else if (e.toString().contains('NotAvailable')) {
        errorMessage = 'Biometric authentication is not available on this device';
      } else if (e.toString().contains('NotEnrolled')) {
        errorMessage = 'No biometric credentials are enrolled. Please set up fingerprint/face unlock in device settings.';
      } else {
        errorMessage = 'Authentication error: ${e.toString()}';
      }
      
      _showSnackBar(errorMessage);
      return;
    }

    if (authenticated) {
      SharedPreferences prefs = await SharedPreferences.getInstance();
      await prefs.setBool('isAuthenticated', true);
      setState(() {
        _isAuthenticated = true;
        _authStatus = 'Authenticated successfully!';
      });
      _showSnackBar('Authentication successful!');
    } else {
      _showSnackBar('Authentication failed');
    }
  }

  Future<void> _register() async {
    if (_emailController.text.isEmpty || _passwordController.text.isEmpty) {
      _showSnackBar('Please fill in all fields');
      return;
    }

    // Simulate registration
    SharedPreferences prefs = await SharedPreferences.getInstance();
    await prefs.setString('user_email', _emailController.text);
    await prefs.setString('user_password', _passwordController.text);
    
    _showSnackBar('Registration successful! You can now login.');
    setState(() {
      _isLogin = true;
    });
    _clearFields();
  }

  Future<void> _login() async {
    if (_emailController.text.isEmpty || _passwordController.text.isEmpty) {
      _showSnackBar('Please fill in all fields');
      return;
    }

    SharedPreferences prefs = await SharedPreferences.getInstance();
    String? savedEmail = prefs.getString('user_email');
    String? savedPassword = prefs.getString('user_password');

    if (savedEmail == _emailController.text && 
        savedPassword == _passwordController.text) {
      
      if (_canCheckBiometrics) {
        _showSnackBar('Login successful! Now use fingerprint for quick access.');
      } else {
        await prefs.setBool('isAuthenticated', true);
        setState(() {
          _isAuthenticated = true;
          _authStatus = 'Logged in successfully!';
        });
      }
    } else {
      _showSnackBar('Invalid credentials');
    }
    _clearFields();
  }

  Future<void> _logout() async {
    SharedPreferences prefs = await SharedPreferences.getInstance();
    await prefs.setBool('isAuthenticated', false);
    setState(() {
      _isAuthenticated = false;
      _authStatus = 'Logged out';
    });
    _showSnackBar('Logged out successfully');
  }

  void _clearFields() {
    _emailController.clear();
    _passwordController.clear();
  }

  void _showSnackBar(String message) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(message)),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text('Fingerprint Auth Demo'),
        backgroundColor: Colors.blue[600],
        elevation: 0,
      ),
      body: SingleChildScrollView(
        padding: EdgeInsets.all(20.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // Status Card
            Card(
              elevation: 4,
              child: Padding(
                padding: EdgeInsets.all(16.0),
                child: Column(
                  children: [
                    Icon(
                      _isAuthenticated ? Icons.check_circle : Icons.security,
                      size: 48,
                      color: _isAuthenticated ? Colors.green : Colors.orange,
                    ),
                    SizedBox(height: 8),
                    Text(
                      'Status: $_authStatus',
                      style: TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.bold,
                      ),
                      textAlign: TextAlign.center,
                    ),
                    SizedBox(height: 8),
                    Text(
                      'Biometrics Available: ${_canCheckBiometrics ? "Yes" : "No"}',
                      style: TextStyle(fontSize: 14, color: Colors.grey[600]),
                    ),
                  ],
                ),
              ),
            ),
            
            SizedBox(height: 20),

            // Authentication Section
            if (!_isAuthenticated) ...[
              // Login/Register Toggle
              Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  TextButton(
                    onPressed: () => setState(() => _isLogin = true),
                    child: Text(
                      'Login',
                      style: TextStyle(
                        fontSize: 18,
                        fontWeight: _isLogin ? FontWeight.bold : FontWeight.normal,
                        color: _isLogin ? Colors.blue : Colors.grey,
                      ),
                    ),
                  ),
                  Text(' | '),
                  TextButton(
                    onPressed: () => setState(() => _isLogin = false),
                    child: Text(
                      'Register',
                      style: TextStyle(
                        fontSize: 18,
                        fontWeight: !_isLogin ? FontWeight.bold : FontWeight.normal,
                        color: !_isLogin ? Colors.blue : Colors.grey,
                      ),
                    ),
                  ),
                ],
              ),
              
              SizedBox(height: 20),

              // Form Fields
              TextField(
                controller: _emailController,
                decoration: InputDecoration(
                  labelText: 'Email',
                  border: OutlineInputBorder(),
                  prefixIcon: Icon(Icons.email),
                ),
                keyboardType: TextInputType.emailAddress,
              ),
              
              SizedBox(height: 16),
              
              TextField(
                controller: _passwordController,
                decoration: InputDecoration(
                  labelText: 'Password',
                  border: OutlineInputBorder(),
                  prefixIcon: Icon(Icons.lock),
                ),
                obscureText: true,
              ),
              
              SizedBox(height: 24),

              // Login/Register Button
              ElevatedButton(
                onPressed: _isLogin ? _login : _register,
                child: Text(
                  _isLogin ? 'Login' : 'Register',
                  style: TextStyle(fontSize: 16),
                ),
                style: ElevatedButton.styleFrom(
                  padding: EdgeInsets.symmetric(vertical: 12),
                ),
              ),
            ],

            SizedBox(height: 20),

            // Fingerprint Authentication Button
            if (_canCheckBiometrics) ...[
              ElevatedButton.icon(
                onPressed: _authenticate,
                icon: Icon(Icons.fingerprint),
                label: Text('Authenticate with Fingerprint'),
                style: ElevatedButton.styleFrom(
                  backgroundColor: Colors.green,
                  foregroundColor: Colors.white,
                  padding: EdgeInsets.symmetric(vertical: 12),
                ),
              ),
            ] else ...[
              Container(
                padding: EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: Colors.orange[50],
                  border: Border.all(color: Colors.orange[300]!),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Row(
                  children: [
                    Icon(Icons.warning, color: Colors.orange),
                    SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        'Biometric authentication is not available on this device',
                        style: TextStyle(color: Colors.orange[700]),
                      ),
                    ),
                  ],
                ),
              ),
            ],

            SizedBox(height: 20),

            // Logout Button
            if (_isAuthenticated)
              ElevatedButton.icon(
                onPressed: _logout,
                icon: Icon(Icons.logout),
                label: Text('Logout'),
                style: ElevatedButton.styleFrom(
                  backgroundColor: Colors.red,
                  foregroundColor: Colors.white,
                  padding: EdgeInsets.symmetric(vertical: 12),
                ),
              ),

            SizedBox(height: 30),

            // Info Section
            Card(
              color: Colors.blue[50],
              child: Padding(
                padding: EdgeInsets.all(16.0),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'How to test:',
                      style: TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.bold,
                        color: Colors.blue[700],
                      ),
                    ),
                    SizedBox(height: 8),
                    Text(
                      '1. Register with email and password\n'
                      '2. Login with the same credentials\n'
                      '3. Use fingerprint for quick authentication\n'
                      '4. Test logout functionality',
                      style: TextStyle(color: Colors.blue[600]),
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  @override
  void dispose() {
    _emailController.dispose();
    _passwordController.dispose();
    super.dispose();
  }
}