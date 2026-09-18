import { NavigatorScreenParams } from '@react-navigation/native';

export type MainTabParamList = {
  Home: undefined;
  Library: undefined;
  StudyChat: undefined;
  Settings: undefined;
};

export type RootStackParamList = {
  Onboarding: undefined;
  Auth: undefined;
  MainTabs: NavigatorScreenParams<MainTabParamList>;
  Summary: { materialId?: string } | undefined;
  Quiz: { materialId?: string } | undefined;
  ConceptMap: { materialId?: string } | undefined;
};
