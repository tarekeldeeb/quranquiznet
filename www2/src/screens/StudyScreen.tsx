import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export default function StudyScreen(){
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Study (placeholder)</Text>
    </View>
  );
}

const styles = StyleSheet.create({ container:{flex:1,alignItems:'center',padding:16}, title:{fontSize:18,fontWeight:'700'}});
