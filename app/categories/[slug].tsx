// app/categories/[slug].tsx
import { useLocalSearchParams, useRouter } from 'expo-router';
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import PersistentWebView from '../../components/PersistentWebView';

export default function CategoryScreen() {
    const { slug } = useLocalSearchParams<{ slug: string }>();
    const router = useRouter();

    console.log('CategoryScreen mounted with slug:', slug);

    // Build the route with the category slug
    const route = slug ? `categories/${slug}` : 'categories';

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <View style={styles.webViewContainer}>
                <PersistentWebView
                    route={route}
                    disableRefresh={false}
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