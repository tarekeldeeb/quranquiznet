import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export default function DailyScreen(){
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Daily (placeholder)</Text>
    </View>
  );
}

const styles = StyleSheet.create({ container:{flex:1,alignItems:'center',padding:16}, title:{fontSize:18,fontWeight:'700'}});
