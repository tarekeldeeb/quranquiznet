import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useProfileStore } from '../stores/profileStore';

export default function ProfileScreen(){
  const parts = useProfileStore(s => s.parts);
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Profile</Text>
      <Text>Parts: {parts ? parts.length : 0}</Text>
    </View>
  );
}

const styles = StyleSheet.create({ container:{flex:1,alignItems:'center',padding:16}, title:{fontSize:18,fontWeight:'700'}});
