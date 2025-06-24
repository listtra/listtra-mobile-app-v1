import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import { StatusBar } from 'expo-status-bar';
import React from 'react';
import {
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';

export default function TermsPage() {
  const router = useRouter();

  const handleDisagree = async () => {
    await SecureStore.setItemAsync('termsStatus', 'rejected');
    router.back();
  };

  const handleAgree = async () => {
    await SecureStore.setItemAsync('termsStatus', 'accepted');
    router.back();
  };

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => router.back()}
          activeOpacity={0.7}
        >
          <Ionicons name="chevron-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Terms & Conditions</Text>
        <View style={styles.spacer} />
      </View>

      <ScrollView style={styles.scrollView}>
        <View style={styles.content}>
          <Text style={styles.lastUpdated}>Last Updated: 5-Mar-2025</Text>
          
          <Text style={styles.paragraph}>
            Welcome to Listtra! These Terms and Conditions govern your access and
            use of our mobile application and services. By using our app, you
            agree to abide by these terms.
          </Text>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>1. Acceptance of Terms</Text>
            <Text style={styles.sectionText}>
              By registering, accessing, or using Listtra, you agree to comply
              with these Terms and Conditions and our Privacy Policy. If you do
              not agree, you must discontinue using the app.
            </Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>2. User Eligibility</Text>
            <View style={styles.listContainer}>
              <Text style={styles.listItem}>• You must be at least 18 years old to use the platform. If you are under 18, you may use the app with the supervision of a parent or guardian.</Text>
              <Text style={styles.listItem}>• Users must provide accurate and up-to-date information during registration.</Text>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>3. Buying and Selling Items</Text>
            <View style={styles.listContainer}>
              <Text style={styles.listItem}>• Sellers must provide accurate descriptions, pricing, and condition details for their items.</Text>
              <Text style={styles.listItem}>• Buyers are responsible for reviewing listings and verifying item details before making a purchase.</Text>
              <Text style={styles.listItem}>• The app serves as a marketplace and does not take responsibility for the quality, authenticity, or delivery of items.</Text>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>4. Prohibited Items</Text>
            <Text style={styles.sectionText}>
              Users may not list, sell, or purchase:
            </Text>
            <View style={styles.listContainer}>
              <Text style={styles.listItem}>• Illegal, stolen, or counterfeit goods</Text>
              <Text style={styles.listItem}>• Weapons, drugs, or hazardous materials</Text>
              <Text style={styles.listItem}>• Items that violate intellectual property laws</Text>
              <Text style={styles.listItem}>• Any other items restricted by local laws</Text>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>5. Transactions and Payments</Text>
            <View style={styles.listContainer}>
              <Text style={styles.listItem}>• Payments may be processed through third-party payment providers. Listtra is not responsible for payment disputes.</Text>
              <Text style={styles.listItem}>• Buyers and sellers are encouraged to meet in safe locations for direct transactions when applicable.</Text>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>6. User Conduct</Text>
            <Text style={styles.sectionText}>You agree not to:</Text>
            <View style={styles.listContainer}>
              <Text style={styles.listItem}>• Engage in fraudulent, misleading, or deceptive activities</Text>
              <Text style={styles.listItem}>• Harass, threaten, or abuse other users</Text>
              <Text style={styles.listItem}>• Use the app for illegal purposes</Text>
              <Text style={styles.listItem}>• Interfere with the app's functionality or security</Text>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>7. Account Suspension and Termination</Text>
            <Text style={styles.sectionText}>
              Listtra reserves the right to suspend or terminate user accounts at
              our discretion, including but not limited to violations of these
              Terms.
            </Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>8. Liability Disclaimer</Text>
            <View style={styles.listContainer}>
              <Text style={styles.listItem}>• Listtra is not responsible for any damages, losses, or disputes arising from transactions between users.</Text>
              <Text style={styles.listItem}>• We do not guarantee the accuracy or reliability of user-generated content.</Text>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>9. Changes to Terms</Text>
            <Text style={styles.sectionText}>
              We may update these Terms from time to time. Continued use of the
              app after updates constitutes acceptance of the revised Terms.
            </Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>10. Contact Information</Text>
            <Text style={styles.sectionText}>
              For any questions or concerns, please contact us at support@listtra.com.
            </Text>
          </View>
        </View>
      </ScrollView>

      {/* Button Section */}
      <View style={styles.buttonContainer}>
        <TouchableOpacity 
          style={styles.disagreeButton}
          onPress={handleDisagree}
        >
          <Text style={styles.disagreeButtonText}>Disagree</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={styles.agreeButton}
          onPress={handleAgree}
        >
          <Text style={styles.agreeButtonText}>Agree</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'white',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: Platform.OS === 'ios' ? 50 : 40,
    paddingBottom: 10,
    paddingHorizontal: 16,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#EEEEEE',
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 18,
    fontWeight: '600',
    color: '#333333',
  },
  spacer: {
    width: 40,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 16,
  },
  lastUpdated: {
    fontSize: 12,
    color: '#757575',
    marginBottom: 12,
  },
  paragraph: {
    fontSize: 14,
    color: '#333333',
    lineHeight: 20,
    marginBottom: 16,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333333',
    marginBottom: 8,
  },
  sectionText: {
    fontSize: 14,
    color: '#555555',
    lineHeight: 20,
    marginBottom: 8,
  },
  listContainer: {
    marginLeft: 8,
  },
  listItem: {
    fontSize: 14,
    color: '#555555',
    lineHeight: 20,
    marginBottom: 8,
  },
  buttonContainer: {
    flexDirection: 'row',
    padding: 16,
    paddingBottom: Platform.OS === 'ios' ? 30 : 16,
    borderTopWidth: 1,
    borderTopColor: '#EEEEEE',
    backgroundColor: 'white',
  },
  disagreeButton: {
    flex: 1,
    backgroundColor: '#F5F5F5',
    paddingVertical: 12,
    borderRadius: 12,
    marginRight: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#DDDDDD',
  },
  disagreeButtonText: {
    color: '#555555',
    fontWeight: '600',
    fontSize: 16,
  },
  agreeButton: {
    flex: 1,
    backgroundColor: '#2528be',
    paddingVertical: 12,
    borderRadius: 12,
    marginLeft: 8,
    alignItems: 'center',
  },
  agreeButtonText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 16,
  },
}); 