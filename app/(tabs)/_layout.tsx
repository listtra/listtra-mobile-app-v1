import { useColorScheme } from 'react-native';
import React from 'react';
import { View, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebViewProvider } from '../../context/WebViewContext';
import SingleWebView from '../../components/SingleWebView';
import CustomTabBar from '../../components/CustomTabBar';
import { useWebView } from '../../context/WebViewContext';

function TabsContent() {
  const { currentRoute, setCurrentRoute } = useWebView();

  const handleRouteChange = (route: string) => {
    console.log('Route changed to:', route);
    setCurrentRoute(route);
  };

  const handleBackPress = () => {
    // Handle back press logic here
    // Return true if you handled the back press, false otherwise
    console.log('Back press on route:', currentRoute);
    
    // For add screen, go back to listings
    if (currentRoute === 'add') {
      setCurrentRoute('listings');
      return true;
    }
    
    return false; // Let WebView handle the back press
  };

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.webViewContainer} edges={['top']}>
        <SingleWebView
          currentRoute={currentRoute}
          onRouteChange={handleRouteChange}
          onBackPress={handleBackPress}
        />
      </SafeAreaView>
      <CustomTabBar />
    </View>
  );
}

export default function TabLayout() {
  return (
    <WebViewProvider>
      <TabsContent />
    </WebViewProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'white',
  },
  webViewContainer: {
    flex: 1,
    backgroundColor: 'white',
  },
});