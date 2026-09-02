import Constants from 'expo-constants';
import Reactotron from 'reactotron-react-native';

// Connect to the machine running Metro (same host trick as the API config), so
// Reactotron works on the Android emulator and physical devices, not just the
// iOS simulator where localhost resolves to the host.
const host = Constants.expoConfig?.hostUri?.split(':')[0] ?? 'localhost';

Reactotron.configure({ name: 'surat-mobile', host })
  .useReactNative() // console logs, network requests, async storage, etc.
  .connect();

export default Reactotron;
