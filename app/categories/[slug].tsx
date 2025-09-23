// app/categories/[slug].tsx
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import PersistentWebView from '../../components/PersistentWebView';

export default function CategoryScreen() {
    const { slug } = useLocalSearchParams<{ slug: string }>();
    const router = useRouter();
    const [key, setKey] = useState(0);


    useFocusEffect(
        React.useCallback(() => {
          setKey(prev => prev + 1);
        }, [])
      );

    // Build the route with the category slug
    const route = slug ? `categories/${slug}` : 'categories';

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <View style={styles.webViewContainer}>
                <PersistentWebView
                    key={key}
                    route={route}
                    disableRefresh={true}
                />
            </View>
        </SafeAreaView>
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